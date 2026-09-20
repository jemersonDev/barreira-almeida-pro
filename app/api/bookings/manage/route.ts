import { and, asc, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appointments, auditLogs, barbers, customers, scheduleBlocks, services } from "../../../../db/schema";
import { buildScheduleWindow, scheduleError } from "../../../../lib/scheduling";
import { enforceRateLimit, rejectOversizedJson } from "../../../../lib/security";
import { sendToProfile } from "../../../../lib/firebase-server";

async function hash(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function uid(prefix:string){return `${prefix}_${crypto.randomUUID()}`}
async function findBooking(id:string,token:string){const db=getDb();const tokenHash=await hash(token);const rows=await db.select({id:appointments.id,status:appointments.status,startsAt:appointments.startsAt,endsAt:appointments.endsAt,barberId:appointments.barberId,barberName:barbers.name,barberProfileId:barbers.profileId,serviceId:appointments.serviceId,serviceName:services.name,priceCents:appointments.priceCents,customerName:customers.name}).from(appointments).innerJoin(barbers,eq(appointments.barberId,barbers.id)).innerJoin(services,eq(appointments.serviceId,services.id)).innerJoin(customers,eq(appointments.customerId,customers.id)).where(and(eq(appointments.id,id),eq(appointments.publicTokenHash,tokenHash))).limit(1);const row=rows[0];return row?{...row,duration:Math.round((row.endsAt.getTime()-row.startsAt.getTime())/60000)}:undefined}

const cleanPhone=(value:string)=>value.replace(/\D/g,"");
const cleanName=(value:string)=>value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g," ");
async function findByIdentity(phone:string,name:string,id?:string){
 const db=getDb(), normalizedPhone=cleanPhone(phone), normalizedName=cleanName(name);
 if(normalizedPhone.length<10||normalizedName.length<2)return [];
 const conditions=[eq(customers.phone,normalizedPhone),inArray(appointments.status,["pending","confirmed"]),gt(appointments.endsAt,new Date())];
 if(id)conditions.push(eq(appointments.id,id));
 const rows=await db.select({id:appointments.id,status:appointments.status,startsAt:appointments.startsAt,endsAt:appointments.endsAt,barberId:appointments.barberId,barberName:barbers.name,serviceId:appointments.serviceId,serviceName:services.name,priceCents:appointments.priceCents,customerName:customers.name}).from(appointments).innerJoin(barbers,eq(appointments.barberId,barbers.id)).innerJoin(services,eq(appointments.serviceId,services.id)).innerJoin(customers,eq(appointments.customerId,customers.id)).where(and(...conditions)).orderBy(asc(appointments.startsAt)).limit(10);
 return rows.filter(row=>cleanName(row.customerName)===normalizedName).map(row=>({...row,duration:Math.round((row.endsAt.getTime()-row.startsAt.getTime())/60000)}));
}

export async function GET(request:Request){const url=new URL(request.url),id=url.searchParams.get("id")||"",token=url.searchParams.get("token")||"";if(!id||!token)return Response.json({error:"Link inválido."},{status:400});const booking=await findBooking(id,token);if(!booking)return Response.json({error:"Agendamento não encontrado."},{status:404});return Response.json({booking})}

export async function POST(request:Request){
 const blockedRequest=enforceRateLimit(request,"booking-lookup",8)||rejectOversizedJson(request);if(blockedRequest)return blockedRequest;
 const body=await request.json() as {phone?:string;name?:string};
 const bookings=await findByIdentity(body.phone||"",body.name||"");
 if(!bookings.length)return Response.json({error:"Nenhum agendamento futuro encontrado com esse nome e telefone."},{status:404});
 return Response.json({bookings},{headers:{"cache-control":"no-store"}});
}

export async function PATCH(request:Request){
 const blockedRequest=enforceRateLimit(request,"booking-manage",12)||rejectOversizedJson(request);if(blockedRequest)return blockedRequest;
 const body=await request.json() as {id?:string;token?:string;action?:"cancel"|"reschedule";date?:string;time?:string}; if(!body.id||!body.token||!body.action)return Response.json({error:"Use o acesso privado recebido ao fazer o agendamento."},{status:403}); const booking=await findBooking(body.id,body.token); if(!booking)return Response.json({error:"Agendamento não encontrado ou acesso inválido."},{status:404}); if(booking.status==="completed")return Response.json({error:"Atendimento concluído não pode ser alterado."},{status:409}); const db=getDb();
 if(booking.status==="cancelled"||booking.status==="no_show")return Response.json({error:"Este agendamento não pode mais ser alterado."},{status:409});
 if(body.action==="cancel"){await db.update(appointments).set({status:"cancelled"}).where(eq(appointments.id,booking.id));await db.insert(auditLogs).values({id:uid("log"),actorProfileId:null,action:"booking.cancelled",entity:"appointment",entityId:booking.id,metadata:JSON.stringify({source:"public_link"}),createdAt:new Date()});await sendToProfile(booking.barberProfileId,{title:"Agendamento cancelado",body:`${booking.customerName} cancelou o horário marcado.`,url:"/operacao"});return Response.json({ok:true,status:"cancelled"})}
 if(!body.date||!body.time)return Response.json({error:"Escolha a nova data e horário."},{status:400}); let startsAt:Date,endsAt:Date;try{({startsAt,endsAt}=buildScheduleWindow(body.date,body.time,booking.duration))}catch(error){return Response.json({error:scheduleError(error)},{status:400})} const overlap=await db.select({id:appointments.id}).from(appointments).where(and(eq(appointments.barberId,booking.barberId),ne(appointments.id,booking.id),inArray(appointments.status,["pending","confirmed"]),lt(appointments.startsAt,endsAt),gt(appointments.endsAt,startsAt))).limit(1);if(overlap.length)return Response.json({error:"Esse horário não está mais disponível."},{status:409});const blocked=await db.select({id:scheduleBlocks.id}).from(scheduleBlocks).where(and(eq(scheduleBlocks.barberId,booking.barberId),eq(scheduleBlocks.active,true),lt(scheduleBlocks.startsAt,endsAt),gt(scheduleBlocks.endsAt,startsAt))).limit(1);if(blocked.length)return Response.json({error:"O barbeiro bloqueou este período."},{status:409});const previousStartsAt=booking.startsAt;await db.update(appointments).set({startsAt,endsAt,status:"confirmed",reminderSentAt:null}).where(eq(appointments.id,booking.id));await db.insert(auditLogs).values({id:uid("log"),actorProfileId:null,action:"booking.rescheduled",entity:"appointment",entityId:booking.id,metadata:JSON.stringify({source:"public_link",from:previousStartsAt.toISOString(),to:startsAt.toISOString()}),createdAt:new Date()});await sendToProfile(booking.barberProfileId,{title:"Agendamento reagendado",body:`${booking.customerName} alterou o horário do atendimento.`,url:"/operacao"});return Response.json({ok:true,status:"confirmed",startsAt:startsAt.toISOString()})
}
