import { and, eq, gte } from "drizzle-orm";
import { appointments, barbers, services } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";

export async function GET(request:Request){
 const auth=await requireStaffApi();if("error" in auth)return auth.error;
 const requested=Number(new URL(request.url).searchParams.get("days")||30),days=[7,30,365].includes(requested)?requested:30;
 const start=new Date(Date.now()-days*24*60*60*1000);
 const scope=auth.profile.role==="owner"?gte(appointments.startsAt,start):and(gte(appointments.startsAt,start),eq(appointments.barberId,auth.barberId));
 const rows=await auth.db.select({status:appointments.status,paymentMethod:appointments.paymentMethod,priceCents:appointments.priceCents,ownerAmountCents:appointments.ownerAmountCents,barberAmountCents:appointments.barberAmountCents,barberId:appointments.barberId,barberName:barbers.name,serviceName:services.name}).from(appointments).innerJoin(barbers,eq(appointments.barberId,barbers.id)).innerJoin(services,eq(appointments.serviceId,services.id)).where(scope);
 const completed=rows.filter(r=>r.status==="completed"),cancelled=rows.filter(r=>r.status==="cancelled"||r.status==="no_show"),sinvasCompleted=completed.filter(r=>r.barberId==="sinvas");
 const group=<T extends string>(key:(row:typeof completed[number])=>T)=>Object.values(completed.reduce<Record<string,{name:string;count:number;grossCents:number;ownerCents:number;barberCents:number}>>((acc,row)=>{const name=key(row);const item=acc[name]||{name,count:0,grossCents:0,ownerCents:0,barberCents:0};item.count++;item.grossCents+=row.priceCents;item.ownerCents+=row.ownerAmountCents;item.barberCents+=row.barberAmountCents;acc[name]=item;return acc},{})).sort((a,b)=>b.grossCents-a.grossCents);
 const grossCents=completed.reduce((s,r)=>s+r.priceCents,0),ownerCents=completed.reduce((s,r)=>s+r.ownerAmountCents,0),barberCents=completed.reduce((s,r)=>s+r.barberAmountCents,0);
 const paymentNames={pix:"Pix",cash:"Dinheiro",card:"Cartão",unknown:"Não informado"} as const;
 const payments=Object.entries(completed.reduce<Record<string,{count:number;totalCents:number}>>((acc,row)=>{const key=row.paymentMethod||"unknown";const item=acc[key]||{count:0,totalCents:0};item.count++;item.totalCents+=row.priceCents;acc[key]=item;return acc},{})).map(([key,value])=>({method:key,name:paymentNames[key as keyof typeof paymentNames]||key,...value})).sort((a,b)=>b.totalCents-a.totalCents);
 const sinvasGrossCents=sinvasCompleted.reduce((s,r)=>s+r.priceCents,0),sinvasRepasseCents=sinvasCompleted.reduce((s,r)=>s+r.ownerAmountCents,0),sinvasAmountCents=sinvasCompleted.reduce((s,r)=>s+r.barberAmountCents,0);
 return Response.json({profile:auth.profile,periodDays:days,summary:{grossCents,completed:completed.length,cancelled:cancelled.length,ticketCents:completed.length?Math.round(grossCents/completed.length):0,myCents:auth.profile.role==="owner"?ownerCents:barberCents,repasseCents:auth.profile.role==="owner"?sinvasRepasseCents:ownerCents,sinvasCompleted:sinvasCompleted.length,sinvasGrossCents,sinvasRepasseCents,sinvasAmountCents},services:group(r=>r.serviceName),barbers:group(r=>r.barberName),payments});
}
