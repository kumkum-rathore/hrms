# Start Here — Hinglish

## 1. ZIP extract karo
`hrms-full` folder ko VS Code mein open karo.

## 2. MongoDB connect karo
Local MongoDB start karo ya MongoDB Atlas database banao. URI `server/.env` mein `MONGODB_URI` ke andar rakho. URI/password public ya GitHub par share mat karna.

## 3. Backend start
PowerShell terminal:

```powershell
cd server
Copy-Item .env.example .env
npm install
```

`.env` mein `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_PEPPER` set karo. Secrets random, unique aur 32+ characters ke rakho.

Superadmin banane ke liye `.env` mein temporary values set karo:

```text
BOOTSTRAP_ADMIN_NAME=System Admin
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=Use-A-Unique-Password-Here-123!
```

Then:

```powershell
npm run create-super-admin
npm run dev
```

Superadmin banne ke baad `BOOTSTRAP_ADMIN_*` values `.env` se remove kar do.

## 4. Frontend start (second terminal)

```powershell
cd client
Copy-Item .env.example .env
npm install
npm run dev
```

Browser mein `http://localhost:5173` kholo.

## 5. Workflow
1. Superadmin login karke Branches mein office + Branch Admin details + initial password bhar kar branch create kare.
2. Superadmin Branch Admin ko permissions dete waqt `Create and assign custom roles` bhi enable kar sakta hai. Har branch ke liye Manager aur HR roles pehli baar Roles section kholne par automatically ban jaate hain.
3. Branch Admin Roles section mein apne custom job-title roles create kar sakta hai. Role sirf title hai; usme permissions nahi hoti. Naya role employee create karte waqt select kiya ja sakta hai; role ki branch scope server par enforce hoti hai.
4. Branch Admin employee banate waqt Employee ya available custom role chun sakta hai aur employee ke liye permissions alag se select karta hai. Permissions employee account par save hoti hain; role se permissions inherit nahi hoti. Employee code aur department code branch code ke saath automatically generate hote hain. Leaving date onboarding par blank hoti hai.
6. Manager task assign/review, attendance, leave aur documents manage kare. HR employee/salary, attendance, leave aur documents manage kare. Employee assigned tasks, apni attendance/salary aur documents dekh sakta hai.
7. Employee apni attendance, leave requests, salary records aur documents dekh/upload kar sakta hai. Salary aur documents private hote hain.

## Notes
- Branch office coordinates longitude-first `[longitude, latitude]` format mein hain.
- File upload limit 25 MB per file; uploads private local folder mein save hote hain.
- Agar `ECONNREFUSED 127.0.0.1:27017` aaye to MongoDB start karo ya Atlas URI check karo.
- Ye starter hai. Actual company data se pehle full test suite, permissions review aur secure production storage setup zaroor karo.


## Branch access rule (corrected)
- Superadmin: branch create kar sakta hai aur sabhi branches aur branch employees ka basic data dekh sakta hai. Woh employee/department/role create nahi kar sakta aur private salary details nahi dekh sakta.
- Branch Admin/Subadmin: `/api/v1/branches` se sirf apni assigned branch dekh sakta hai; doosri branch ka ID/query dene par bhi doosri branch ka data nahi milta. Branch create karne ka API access nahi hai.
- Branch Admin sirf apni branch ke departments, custom roles aur employees create kar sakta hai. Role/department assignment mein employee, role aur department ka branch match server par verify hota hai. Employee create karte waqt sirf Branch Admin ko di hui permissions us employee ko assign ki ja sakti hain.
- Frontend mein Branch Admin ko `My Branch` label dikhega, jabki Superadmin ko `Branches` dikhega.
