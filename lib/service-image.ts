export function defaultServiceImage(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("infantil") || normalized.includes("crianca")) {
    return "/services/corte-infantil.webp";
  }
  if (normalized.includes("sobrancelha")) {
    return "/services/corte-sobrancelha.webp";
  }
  if (normalized.includes("corte") && normalized.includes("barba")) {
    return "/services/corte-barba.webp";
  }
  if (normalized.includes("barba")) return "/services/barba.webp";
  if (normalized.includes("corte") && !normalized.includes("vip")) {
    return "/services/corte.webp";
  }
  return "/services/padrao-vip.webp";
}
