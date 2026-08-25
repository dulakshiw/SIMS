# Demonstration Data Seed

`seed-demo-data.js` inserts clearly fictional records for supervisor demonstrations. It does not alter the schema, delete existing records, or overwrite records that do not carry the `DEMO-SIMS-2026` marker.

The script discovers the existing live columns, supports the current legacy inventory column names, resolves role/department/user/inventory IDs, validates references through the database, and runs in one transaction. A failed run is rolled back.

## Run on Windows PowerShell

From the repository root:

```powershell
$env:DEMO_PASSWORD = "choose-a-demo-password"
npm.cmd run seed:demo
```

`DEMO_PASSWORD` must be at least 8 characters. It is hashed at runtime with `bcryptjs` using 12 salt rounds. The plaintext value is not inserted into the database. Use the same value to sign in with the fictional accounts created by the seed, for example `demo.admin@sims.invalid` or `demo.inventory.cs@sims.invalid`.

The script creates or reuses marked demonstration records for:

- available, issued, under-repair, under-transfer, and under-disposal items
- within-warranty and out-of-warranty examples
- duplicate item-code and serial-number validation
- warranty claim and out-of-warranty repair workflows
- active transfer, disposal, and repair locks
- pending, approved, issued, and rejected item requests
- inventory creation and account approval workflows
- dashboard and report counts

Warranty expiry follows the application model: `purchased_date` is the warranty start date and `warranty` stores a duration such as `3 Years`. Categories are included in item remarks because the existing schema has no category column.

The seed uses `.env` for the existing MySQL connection settings. Start the API after seeding with `npm.cmd run dev:server`, then start Vite with `npm.cmd run dev`.
