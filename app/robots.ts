import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: ["/", "/agendar"], disallow: ["/gestao", "/login", "/meu-agendamento", "/api/"] }], sitemap: "https://barbearia-almeida-pro.alratao29.chatgpt.site/sitemap.xml" }; }
