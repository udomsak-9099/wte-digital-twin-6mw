# ⚡ WtE Digital Twin 6.6 MW — คู่มือเริ่มต้นสำหรับทีม

🌐 **Dashboard (เปิดได้จากทุกที่)**
→ https://web-seven-livid-89.vercel.app

🐙 **GitHub (Public)**
→ https://github.com/udomsak-9099/wte-digital-twin-6mw

---

## 🚀 วิธีเริ่มต้น (ทำครั้งแรกครั้งเดียว)

### 1. Clone โปรเจกต์
```bash
git clone git@github.com:udomsak-9099/wte-digital-twin-6mw.git
cd wte-digital-twin-6mw
```

### 2. ขอ keys จากทีมลีด
ติดต่อ **ukaewsiri@gmail.com** เพื่อขอ Supabase keys

จากนั้น copy ไฟล์ config:
```bash
cp config/.env.example      config/.env
cp frontend/web/.env.example frontend/web/.env.local
```
เปิดไฟล์และใส่ key จริงที่ได้รับ

### 3. รัน frontend
```bash
cd frontend/web
npm install
npm run dev
# เปิดที่ http://localhost:5110
```

### 4. รัน mock DCS (terminal ที่ 2)
```bash
uv run python opcua/bridge/mock_poller.py
# ข้อมูลเข้า dashboard ทุก 5 วินาที
```

> ครั้งแรกเท่านั้น — seed ข้อมูล lab ตัวอย่าง:
> ```bash
> uv run python opcua/bridge/seed_lab.py
> ```

---

## 🌿 Git Workflow

```bash
# ก่อนทำงานทุกครั้ง
git pull origin main

# สร้าง branch ของตัวเอง
git checkout -b feature/ชื่องาน

# เสร็จแล้ว push + เปิด PR
git add .
git commit -m "feat: อธิบายสิ่งที่ทำ"
git push origin feature/ชื่องาน
# → เปิด Pull Request บน GitHub → รอ review → merge
```

> ❗ **main branch ถูก lock ไว้** — push ตรงไม่ได้ ต้องผ่าน PR เท่านั้น

### Branch naming
| ประเภท | รูปแบบ | ตัวอย่าง |
|---|---|---|
| ฟีเจอร์ใหม่ | `feature/xxx` | `feature/turbine-chart` |
| แก้บัก | `fix/xxx` | `fix/relay-display` |
| เปลี่ยน DB | `migration/xxx` | `migration/add-vibration` |
| เอกสาร | `docs/xxx` | `docs/opcua-setup` |

### Commit format
```
feat:      เพิ่มฟีเจอร์ใหม่
fix:       แก้บัก
refactor:  ปรับโครงสร้าง
chore:     config / เครื่องมือ
migration: เปลี่ยน database schema
```

---

## 🗂️ แบ่งหน้าที่

| พื้นที่ | ไฟล์หลัก | หน้าที่ |
|---|---|---|
| Frontend | `frontend/web/src/App.tsx` | แดชบอร์ด, แท็บ, กราฟ |
| Backend API | `backend/api/main.py` | REST endpoints, simulation |
| DCS Bridge | `opcua/bridge/mock_poller.py` | ข้อมูล sensor, lab |
| Database | `supabase/migrations/` | schema — สร้างใหม่เท่านั้น |
| MATLAB | `matlab/core/s0x_*.m` | simulation scripts |

---

## 🔒 กฎสำคัญ — ห้ามทำเด็ดขาด

| ❌ ห้าม | เหตุผล |
|---|---|
| commit ไฟล์ `.env` | มี key ลับ — ถูก gitignore ไว้แล้ว |
| แก้ migration ไฟล์เก่า | ทำให้ sync พัง — สร้างไฟล์ใหม่เท่านั้น |
| ใช้ `SERVICE_KEY` ใน frontend | ใช้ `ANON_KEY` เท่านั้นสำหรับ frontend |
| push ตรงไปยัง `main` | ต้องผ่าน PR + review ก่อนเสมอ |

---

## ➕ วิธีเพิ่ม Sensor ใหม่ (checklist)

- [ ] สร้าง `supabase/migrations/YYYYMMDD_xxx.sql` → เพิ่ม column
- [ ] รัน `supabase db push`
- [ ] เพิ่ม field ใน `PlantTelemetry` type ที่ `supabaseClient.ts`
- [ ] เพิ่มค่า simulate ใน `mock_poller.py` → `simulate_plant()`
- [ ] แสดงผลในแท็บที่เกี่ยวข้องใน `App.tsx`
- [ ] เปิด PR → รอ review → merge

---

## 🌐 Deploy ขึ้น Production

Vercel จะ deploy อัตโนมัติเมื่อ PR merge เข้า `main`

หรือ deploy ด้วยมือ:
```bash
cd frontend/web
npm run build
npx vercel deploy --prod --yes
```

---

## 📞 ติดต่อทีมลีด

**Udomsak Kaewsiri** — ukaewsiri@gmail.com
