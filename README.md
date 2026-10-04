# دوري المشكاة المدرسي

تطبيق عربي RTL لإدارة دوري كرة القدم المدرسي في متوسطة وثانوية مدارس المشكاة.

## الوظائف
- جدول مباريات الدوريين حسب ملف الموسم 1448هـ.
- دوري أول متوسط بنظام ذهاب وعودة.
- دوري الصفين الثاني والثالث متوسط من دور واحد.
- إدخال النتيجة وتحديث الترتيب تلقائيًا.
- دعم تأجيل المباراة وإلغاء النتيجة.
- واجهة متجاوبة للجوال والكمبيوتر.

## Neon
Project: `misty-shadow-06396184`
Branch: `production`

إعداد Neon المطلوب للمشروع:

```bash
npm i -g neon@latest && neon login
neon skills -y
neon mcp -y
neon link --project-id misty-shadow-06396184 --branch production -y
neon config init
neon deploy
```

ملف `neon.ts`:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

## الواجهة
الملفات الرئيسية:
- `index.html`
- `styles.css`
- `app.js`
- `config.js`

عند ربط Neon Data API يوضع رابط الخدمة في `config.js` داخل `dataApiUrl`.
