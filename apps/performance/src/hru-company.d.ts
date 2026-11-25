// /shared/company.js (ระบบ HR รวมศูนย์) — บริษัทที่ทำงาน CMN/CIL ใช้ร่วมกันทุกแอป
interface HRUCompanyApi {
  get(): string;
  set(c: string): void;
  ensure(): void;
  change(): void;
  mount(el: HTMLElement): void;
  onChange(fn: (c: string) => void): () => void;
}
interface Window { HRUCompany?: HRUCompanyApi }
