import { and, eq, gte, lt } from "drizzle-orm";
import { appointments, auditLogs, barbers, customers, services, settlements } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";

function uid(prefix:string){return `${prefix}_${crypto.randomUUID()}`}
function parseDate(value:string,end=false){return new Date(`${value}T${end?"23:59:59":"00:00:00"}-03:00`)}

export async function GET(request:Request){
 const auth=await requireStaffApi();if("error" in auth)return auth.error;if(auth.profile.role!=="owner")return Response.json({error:"Área exclusiva do proprietário."},{status:403});
 const url=new URL(request.url),from=url.searchParams.get("from")||new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"}),to=url.searchParams.get("to")||from;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))return Response.json({error:"Período inválido."},{status:400});
 const start=parseDate(from),end=parseDate(to,true);
 const entries=await auth.db.select({id:appointments.id,startsAt:appointments.startsAt,status:appointments.status,priceCents:appointments.priceCents,paymentMethod:appointments.paymentMethod,ownerAmountCents:appointments.ownerAmountCents,barberAmountCents:appointments.barberAmountCents,barberId:appointments.barberId,barberName:barbers.name,serviceName:services.name,customerName:customers.name,customerPhone:customers.phone}).from(appointments).innerJoin(barbers,eq(appointments.barberId,barbers.id)).innerJoin(services,eq(appointments.serviceId,services.id)).innerJoin(customers,eq(appointments.customerId,customers.id)).where(and(gte(appointments.startsAt,start),lt(appointments.startsAt,end))).orderBy(appointments.startsAt);
 const completed=entries.filter(e=>e.status==="completed"),grossCents=completed.reduce((s,e)=>s+e.priceCents,0),lucasCents=completed.reduce((s,e)=>s+e.ownerAmountCents,0),sinvasCents=completed.filter(e=>e.barberId==="sinvas").reduce((s,e)=>s+e.barberAmountCents,0),repasseCents=completed.filter(e=>e.barberId==="sinvas").reduce((s,e)=>s+e.ownerAmountCents,0);
 const paid=await auth.db.select({id:settlements.id,periodStart:settlements.periodStart,periodEnd:settlements.periodEnd,ownerAmountCents:settlements.ownerAmountCents,paidCents:settlements.paidCents,status:settlements.status,paidAt:settlements.paidAt}).from(settlements).where(eq(settlements.barberId,"sinvas"));
 return Response.json({profile:auth.profile,period:{from,to},summary:{grossCents,lucasCents,sinvasCents,repasseCents,completed:completed.length},entries,settlements:paid});
}

export async function POST(request:Request){
 const auth=await requireStaffApi();if("error" in auth)return auth.error;if(auth.profile.role!=="owner")return Response.json({error:"Área exclusiva do proprietário."},{status:403});
 const body=await request.json() as {from?:string;to?:string;paymentMethod?:string};if(!body.from||!body.to||!/^\d{4}-\d{2}-\d{2}$/.test(body.from)||!/^\d{4}-\d{2}-\d{2}$/.test(body.to))return Response.json({error:"Período inválido."},{status:400});
 const start=parseDate(body.from),end=parseDate(body.to,true);if(end<start)return Response.json({error:"A data final deve ser posterior à inicial."},{status:400});
 const existing=await auth.db.select({id:settlements.id}).from(settlements).where(and(eq(settlements.barberId,"sinvas"),lt(settlements.periodStart,end),gte(settlements.periodEnd,start))).limit(1);if(existing.length)return Response.json({error:"Já existe um fechamento neste período."},{status:409});
 const rows=await auth.db.select({priceCents:appointments.priceCents,ownerAmountCents:appointments.ownerAmountCents,barberAmountCents:appointments.barberAmountCents}).from(appointments).where(and(eq(appointments.barberId,"sinvas"),eq(appointments.status,"completed"),gte(appointments.startsAt,start),lt(appointments.startsAt,end)));
 if(!rows.length)return Response.json({error:"Não existem atendimentos concluídos do Sinvas neste período."},{status:409});
 const id=uid("set"),grossCents=rows.reduce((s,r)=>s+r.priceCents,0),ownerAmountCents=rows.reduce((s,r)=>s+r.ownerAmountCents,0),barberAmountCents=rows.reduce((s,r)=>s+r.barberAmountCents,0),now=new Date();
 await auth.db.insert(settlements).values({id,barberId:"sinvas",periodStart:start,periodEnd:end,grossCents,ownerAmountCents,barberAmountCents,paidCents:ownerAmountCents,status:"paid",paymentMethod:(body.paymentMethod||"pix").slice(0,30),paidAt:now,confirmedBy:auth.profile.id});
 await auth.db.insert(auditLogs).values({id:uid("log"),actorProfileId:auth.profile.id,action:"settlement.paid",entity:"settlement",entityId:id,metadata:JSON.stringify({barberId:"sinvas",from:body.from,to:body.to,paidCents:ownerAmountCents}),createdAt:now});
 return Response.json({ok:true,settlement:{id,grossCents,ownerAmountCents,barberAmountCents,status:"paid"}},{status:201});
}
