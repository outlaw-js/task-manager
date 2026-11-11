# تسک منیجر

مدیریت تسک با کانبان برد — Next.js 15 (App Router) + PostgreSQL + Prisma، با رابط کاربری فارسی و راست‌چین.

## امکانات

- **ورود و ثبت‌نام** با ایمیل و رمز عبور (JWT در کوکی httpOnly)
- **چند برد** برای هر کاربر؛ ستون‌های پیش‌فرض و برچسب‌های اولیه هنگام ساخت برد
- **کانبان برد با Drag & Drop** (dnd-kit): جابه‌جایی بین ستون‌ها و تغییر ترتیب داخل ستون، ذخیره در دیتابیس
- **افزودن افراد** به برد با ایمیل؛ اگر حساب نداشته باشند همان‌جا برایشان حساب ساخته می‌شود
- **Assign کردن** تسک به یک یا چند عضو
- **ددلاین** با تقویم شمسی و انتخاب ساعت (`react-multi-date-picker`)؛ نمایش قرمز برای گذشته از موعد و نارنجی برای کمتر از ۲۴ ساعت
- **برچسب** (ساخت، تغییر رنگ و نام، حذف)، **اولویت** (فوری / زیاد / متوسط / کم) و **توضیحات**
- **فیلتر** بر اساس جستجو، کارهای من، مسئول (یا بدون مسئول)، برچسب، اولویت، ددلاین (گذشته / امروز / ۷ روز آینده / بدون ددلاین / بازه دلخواه شمسی)
- **مرتب‌سازی**: ترتیب دستی، نزدیک‌ترین ددلاین، بیشترین اولویت، جدیدترین، الفبایی
- مدیریت ستون‌ها: افزودن، تغییر نام (دابل‌کلیک)، رنگ، جابه‌جایی و حذف

## راه‌اندازی

```bash
npm install
cp .env.example .env        # و JWT_SECRET را عوض کنید
npm run db:up               # Postgres در Docker روی پورت 5435
npm run db:push             # ساخت جدول‌ها
npm run db:seed             # داده نمونه (اختیاری)
npm run dev                 # http://localhost:3100
```

### حساب‌های نمونه (بعد از `db:seed`)

| ایمیل | رمز |
| --- | --- |
| admin@example.com (مالک برد نمونه) | demo1234 |
| sara@example.com | demo1234 |
| ali@example.com | demo1234 |

## ساختار

```
prisma/schema.prisma        مدل‌ها: User, Board, BoardMember, Column, Label, Task
src/middleware.ts           محافظت از صفحات و API
src/lib/                    auth، prisma، اعتبارسنجی، فیلتر و مرتب‌سازی
src/app/api/                Route handlerها (auth, boards, members, labels, columns, tasks, reorder)
src/components/board/       BoardView (DnD)، Column، TaskCard، TaskModal، FilterBar، ...
```
