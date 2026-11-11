import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-5xl font-black text-slate-300">۴۰۴</p>
      <p className="font-medium">صفحه یا برد مورد نظر پیدا نشد</p>
      <Link href="/" className="btn-primary">بازگشت به بردها</Link>
    </div>
  );
}
