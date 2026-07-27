// practiceuatseed loads the Alok Practice UAT dataset (Architecture D5 / BC-P0-13).
//
// Usage (from Go/):
//
//	go run ./cmd/practiceuatseed
//	go build -o practiceuatseed.exe ./cmd/practiceuatseed
//
// Env (defaults match local Postgres): DB_HOST=localhost DB_PORT=5432
// DB_USER=smartca DB_PASSWORD=yourpassword DB_NAME=smartca
//
// Idempotent: wipes only PRACTICE-* rows and @practice.smartca.in users.
// Does NOT touch WM-* load seed or USR-* demo users.
//
// Targets: 55 named users, 300 clients, 100 companies, ~120 engagements, ≥500 works.
// Password for all practice users: SmartCA@2025
//
// Sample logins (preferred UAT):
//
//	senior_ca  vikram@practice.smartca.in
//	junior_ca  aditya@practice.smartca.in
//	accountant ganesh@practice.smartca.in
//	article    kunal@practice.smartca.in
//	manager    alok@practice.smartca.in
//
// Demo USR aliases (also get PRACTICE portfolios when present):
//
//	suresh.gupta@smartca.in / rahul.joshi@smartca.in /
//	arun.mehta@smartca.in / sanjay.verma@smartca.in
package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/lib/pq"
	_ "github.com/lib/pq"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

const (
	nClients      = 300
	nCompanies    = 100
	nEngagements  = 120
	nWorks        = 500
	nIntakes      = 15
	passwordHash  = "$2a$10$LfjRwo5HgMU/P2xEQMtaYu1PNHkOXL/ZrDAdhKG8Ob9j2XRw5i2la" // SmartCA@2025
	emailDomain   = "@practice.smartca.in"
	idPrefix      = "PRACTICE-"
	orgName       = "Alok Practice — Pune CA Firm"
)

var goldenClients = []struct {
	id, name, city string
}{
	{"PRACTICE-CLT-ABC", "ABC Traders Pvt Ltd", "Pune"},
	{"PRACTICE-CLT-BRIGHT", "Bright Pharma LLP", "Mumbai"},
	{"PRACTICE-CLT-CLOUDNINE", "CloudNine Softwares", "Bengaluru"},
	{"PRACTICE-CLT-MEHTA", "Mehta Family (Individual)", "Pune"},
	{"PRACTICE-CLT-ZENITH", "Zenith Infra Projects", "Nagpur"},
}

func main() {
	loadDotEnv(".env")
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getenv("DB_HOST", "localhost"), getenv("DB_PORT", "5432"),
		getenv("DB_USER", "smartca"), getenv("DB_PASSWORD", "yourpassword"), getenv("DB_NAME", "smartca"))
	db, err := sql.Open("postgres", dsn)
	must(err)
	defer db.Close()
	must(db.Ping())

	roster := practiceRoster()
	if len(roster) != 55 {
		log.Fatalf("roster must be exactly 55 users, got %d", len(roster))
	}

	log.Println("wiping Practice UAT ids only (PRACTICE-* / @practice.smartca.in)…")
	wipePractice(db)

	log.Println("seeding 55 named users…")
	seedUsers(db, roster)

	log.Println("seeding clients / companies / engagements…")
	clients := seedClients(db)
	companies := seedCompanies(db, clients)
	engagements := seedEngagements(db, clients, companies, roster)

	log.Println("seeding practice works + intakes…")
	seedWorks(db, clients, companies, engagements, roster)
	seedIntakes(db, roster)

	log.Println("seeding demo USR role portfolios (BUG-0012)…")
	seedDemoRolePortfolios(db, clients, companies, engagements, roster)

	printCounts(db)
	verifyNamed(db)
	verifyRolePortfolios(db)
	log.Println("practiceuatseed complete")
	log.Println("password for all practice users: SmartCA@2025")
	log.Println("UAT preferred (Practice):")
	log.Println("  senior_ca  vikram@practice.smartca.in")
	log.Println("  junior_ca  aditya@practice.smartca.in")
	log.Println("  accountant ganesh@practice.smartca.in")
	log.Println("  article    kunal@practice.smartca.in")
	log.Println("UAT demo aliases (also seeded portfolios if USR-* present):")
	log.Println("  suresh.gupta@smartca.in  rahul.joshi@smartca.in")
	log.Println("  arun.mehta@smartca.in    sanjay.verma@smartca.in")
	log.Println("  alok@practice.smartca.in  nitesh@practice.smartca.in  mukesh@practice.smartca.in")
}

func wipePractice(db *sql.DB) {
	// Child rows for PRACTICE works first (FK RESTRICT).
	childDeletes := []string{
		`DELETE FROM wm_notifications WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_audit WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_activity WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_attachments WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_comments WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_notes WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_meeting_logs WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_email_logs WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_call_logs WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_followups WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_checklist_items WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_work_transitions WHERE work_item_id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_work_items WHERE id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_intakes WHERE id LIKE 'PRACTICE-%'`,
		`DELETE FROM wm_engagements WHERE id LIKE 'PRACTICE-%'`,
		`DELETE FROM companies WHERE id LIKE 'PRACTICE-%'`,
		`DELETE FROM clients WHERE id LIKE 'PRACTICE-%'`,
		`DELETE FROM users WHERE id LIKE 'PRACTICE-%' OR lower(data->>'email') LIKE '%` + emailDomain + `'`,
	}
	for _, s := range childDeletes {
		if _, err := db.Exec(s); err != nil {
			log.Printf("wipe warn: %v (%s)", err, truncate(s, 80))
		}
	}
}

func seedUsers(db *sql.DB, roster []seedUser) {
	for _, u := range roster {
		perms := append([]string{}, workmgmt.PermissionsForRole(u.Role)...)
		// App shell perms so FE nav works for UAT logins.
		perms = appendUnique(perms, "dashboard.view", "clients.view", "companies.view")
		data := map[string]any{
			"id":           u.ID,
			"email":        u.Email,
			"fullName":     u.FullName,
			"firstName":    strings.Fields(u.FullName)[0],
			"role":         u.Role,
			"roleName":     u.Role,
			"department":   u.Dept,
			"designation":  u.Designation,
			"status":       "active",
			"passwordHash": passwordHash,
			"permissions":  perms,
			"loginId":      u.Email,
			"username":     strings.Split(u.Email, "@")[0],
			"organization": orgName,
			"reportsTo":    u.ReportsTo,
			"reports_to":   u.ReportsTo,
			"seed":         "practice_uat",
		}
		if u.Role == "hr" {
			data["placementStatus"] = "ACTIVE"
		}
		raw, _ := json.Marshal(data)
		_, err := db.Exec(`INSERT INTO users (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW())
			ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, archived=false, updated_at=NOW()`, u.ID, raw)
		must(err)
	}
	// Two PENDING_PLACEMENT placeholders (Architecture D5) — still practice users, not yet in delivery.
	for i, name := range []string{"Pending Hire One", "Pending Hire Two"} {
		id := fmt.Sprintf("PRACTICE-PEND-%02d", i+1)
		email := fmt.Sprintf("pending%d%s", i+1, emailDomain)
		data, _ := json.Marshal(map[string]any{
			"id": id, "email": email, "fullName": name, "role": "employee", "roleName": "employee",
			"department": "Unassigned", "designation": "Pending Placement", "status": "active",
			"passwordHash": passwordHash, "permissions": workmgmt.PermissionsForRole("employee"),
			"loginId": email, "organization": orgName, "reportsTo": "", "reports_to": "",
			"placementStatus": "PENDING_PLACEMENT", "seed": "practice_uat",
		})
		_, err := db.Exec(`INSERT INTO users (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW())
			ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, archived=false, updated_at=NOW()`, id, data)
		must(err)
	}
}

func seedClients(db *sql.DB) []string {
	ids := make([]string, 0, nClients)
	tx, err := db.Begin()
	must(err)
	stmt, err := tx.Prepare(`INSERT INTO clients (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
	must(err)
	defer stmt.Close()

	cities := []string{"Pune", "Mumbai", "Nagpur", "Nashik", "Bengaluru", "Delhi"}
	for _, g := range goldenClients {
		data, _ := json.Marshal(map[string]any{
			"id": g.id, "name": g.name, "status": "active", "city": g.city,
			"email": fmt.Sprintf("contact+%s@example.com", strings.ToLower(strings.TrimPrefix(g.id, "PRACTICE-CLT-"))),
			"golden": true, "seed": "practice_uat", "organization": orgName,
		})
		must(execIgnore(stmt, g.id, data))
		ids = append(ids, g.id)
	}
	for i := 1; len(ids) < nClients; i++ {
		id := fmt.Sprintf("PRACTICE-CLT-%04d", i)
		// skip if collides with golden short ids
		if strings.HasPrefix(id, "PRACTICE-CLT-ABC") {
			continue
		}
		name := fmt.Sprintf("Practice Client %04d", i)
		data, _ := json.Marshal(map[string]any{
			"id": id, "name": name, "status": "active", "city": cities[i%len(cities)],
			"email": fmt.Sprintf("client%d@example.com", i), "seed": "practice_uat",
		})
		must(execIgnore(stmt, id, data))
		ids = append(ids, id)
	}
	must(tx.Commit())
	return ids
}

func seedCompanies(db *sql.DB, clients []string) []string {
	ids := make([]string, 0, nCompanies)
	tx, err := db.Begin()
	must(err)
	stmt, err := tx.Prepare(`INSERT INTO companies (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
	must(err)
	defer stmt.Close()

	// Golden company links for ABC / Bright / CloudNine / Zenith (Mehta is individual — no company)
	goldenMap := map[string]string{
		"PRACTICE-CLT-ABC":       "PRACTICE-CMP-ABC",
		"PRACTICE-CLT-BRIGHT":    "PRACTICE-CMP-BRIGHT",
		"PRACTICE-CLT-CLOUDNINE": "PRACTICE-CMP-CLOUDNINE",
		"PRACTICE-CLT-ZENITH":    "PRACTICE-CMP-ZENITH",
	}
	for cli, cmp := range goldenMap {
		name := "Company"
		for _, g := range goldenClients {
			if g.id == cli {
				name = g.name
				break
			}
		}
		data, _ := json.Marshal(map[string]any{
			"id": cmp, "clientId": cli, "name": name, "status": "active",
			"seed": "practice_uat", "industry": "Services",
		})
		must(execIgnore(stmt, cmp, data))
		ids = append(ids, cmp)
	}
	for i := 1; len(ids) < nCompanies; i++ {
		id := fmt.Sprintf("PRACTICE-CMP-%04d", i)
		cli := clients[(i+5)%len(clients)]
		data, _ := json.Marshal(map[string]any{
			"id": id, "clientId": cli, "name": fmt.Sprintf("Practice Co %04d", i),
			"status": "active", "seed": "practice_uat", "industry": []string{"Manufacturing", "IT", "Trading", "Services"}[i%4],
		})
		must(execIgnore(stmt, id, data))
		ids = append(ids, id)
	}
	must(tx.Commit())
	return ids
}

func seedEngagements(db *sql.DB, clients, companies []string, roster []seedUser) []string {
	cas := rosterByRole("ca")
	ids := make([]string, 0, nEngagements)
	tx, err := db.Begin()
	must(err)
	now := time.Now().UTC()
	for i := 1; i <= nEngagements; i++ {
		id := fmt.Sprintf("PRACTICE-ENG-%04d", i)
		cli := clients[i%len(clients)]
		var cmp any
		if i%3 != 0 && len(companies) > 0 {
			cmp = companies[i%len(companies)]
		} else {
			cmp = nil
		}
		ca := cas[i%len(cas)]
		svcs := pq.Array([]string{[]string{"GST", "ITR", "Audit", "ROC", "TDS"}[i%5]})
		_, err := tx.Exec(`INSERT INTO wm_engagements (
			id, client_id, company_id, owner_ca_id, services, status, fy, title, created_by, updated_by, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,'ACTIVE','FY2025-26',$6,$7,$7,$8,$8)
		ON CONFLICT (id) DO NOTHING`,
			id, cli, cmp, ca.ID, svcs, fmt.Sprintf("Retainer %s #%d", ca.FullName, i), "PRACTICE-MGR-ALOK", now)
		must(err)
		ids = append(ids, id)
	}
	must(tx.Commit())
	return ids
}

func seedWorks(db *sql.DB, clients, companies, engagements []string, roster []seedUser) {
	cas := rosterByRole("ca")
	scas := rosterByRole("senior_ca")
	tls := rosterByRole("team_leader")
	// Executors include junior_ca / article / accountant / employee so assignee list scope is non-empty.
	executors := append(append(rosterByRole("junior_ca"), rosterByRole("article_assistant")...), rosterByRole("accountant")...)
	executors = append(executors, rosterByRole("employee")...)

	statuses := []string{
		"OPEN", "DOCUMENT_PENDING", "DOCUMENT_RECEIVED", "IN_PROGRESS", "BLOCKED",
		"READY_FOR_TL_VERIFY", "TL_VERIFIED", "READY_FOR_CA_VERIFY", "CA_VERIFIED",
		"READY_FOR_MANAGER_CLOSE", "DELIVERED", "CLOSED",
	}
	// Bias toward doc pending + review queues (~25% each family) per TEST_DATA_PLAN quality bar.
	statusPick := func(i int) string {
		switch i % 20 {
		case 0, 1, 2, 3, 4:
			return "DOCUMENT_PENDING"
		case 5, 6, 7, 8, 9:
			return statuses[5+(i%4)] // review queues
		default:
			return statuses[i%len(statuses)]
		}
	}
	workTypes := []string{"GSTR1", "GSTR3B", "ITR", "TDS", "ROC_AOC4", "AUDIT"}
	overlays := []string{"GST_MONTH", "ITR", "ROC", "NOTICE", ""}
	risks := []string{"low", "medium", "high"}
	priorities := []string{"low", "medium", "high", "urgent"}

	tx, err := db.Begin()
	must(err)
	stmt, err := tx.Prepare(`
		INSERT INTO wm_work_items (
			id, title, description, priority, status, due_date, created_date,
			assigned_by, assigned_to, client_id, client_name, department, tags,
			estimated_hours, actual_hours, completion_pct, parent_id, created_by, updated_by,
			created_at, updated_at,
			company_id, engagement_id, work_type, period_key, fy, overlay, risk_class,
			owner_ca_id, tl_id, assignee_id, delegated_close, requires_partner_signoff
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NULL,$17,$17,$18,$18,
			$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,false,$29
		) ON CONFLICT (id) DO NOTHING`)
	must(err)
	defer stmt.Close()

	now := time.Now().UTC()
	clientName := func(id string) string {
		for _, g := range goldenClients {
			if g.id == id {
				return g.name
			}
		}
		return id
	}

	for i := 1; i <= nWorks; i++ {
		id := fmt.Sprintf("PRACTICE-WRK-%04d", i)
		ca := cas[i%len(cas)]
		tl := tls[i%len(tls)]
		ex := executors[i%len(executors)]
		// BUG-0012: ~20% of works use Senior CA as owner_ca so professional list scope is non-empty.
		owner := ca
		if len(scas) > 0 && i%5 == 0 {
			owner = scas[i%len(scas)]
		}
		cli := clients[i%len(clients)]
		eng := engagements[i%len(engagements)]
		wt := workTypes[i%len(workTypes)]
		var cmp any
		// Always unique period keys to satisfy uq_wm_work_company_period / client_period.
		periodKey := fmt.Sprintf("2025-%02d-W%04d", (i%12)+1, i)
		if i%4 != 0 && len(companies) > 0 {
			cmp = companies[i%len(companies)]
		} else {
			cmp = nil
		}
		st := statusPick(i)
		pct := 0
		if st == "CLOSED" || st == "DELIVERED" {
			pct = 100
		} else if st == "IN_PROGRESS" {
			pct = 30 + (i % 50)
		}
		risk := risks[i%len(risks)]
		partnerFlag := risk == "high" && i%7 == 0
		due := now.Add(time.Duration((i%45)-15) * 24 * time.Hour)
		title := fmt.Sprintf("%s — %s #%d", wt, clientName(cli), i)
		dept := owner.Dept
		_, err := stmt.Exec(
			id, title, "Practice UAT work for Alok firm gates / triad validation",
			priorities[i%len(priorities)], st, due, now,
			tl.ID, ex.ID, cli, clientName(cli), dept, pq.Array([]string{"practice_uat", wt}),
			float64(4+(i%16)), float64(i%12), pct, owner.ID, now,
			cmp, eng, wt, periodKey, "FY2025-26", overlays[i%len(overlays)], risk,
			owner.ID, tl.ID, ex.ID, partnerFlag,
		)
		must(err)
		if i%100 == 0 {
			log.Printf("  work %d/%d", i, nWorks)
		}
	}
	must(tx.Commit())
}

// seedDemoRolePortfolios assigns PRACTICE works to classic demo USR-* emails cited in BUG-0012
// (suresh.gupta / rahul.joshi / arun.mehta / sanjay.verma) when those users exist in the DB.
// Preferred UAT remains @practice.smartca.in; demo aliases are kept for QA scripts that still use them.
func seedDemoRolePortfolios(db *sql.DB, clients, companies, engagements []string, roster []seedUser) {
	type demoSlot struct {
		email string
		as    string // owner_ca | assignee
		uid   string
	}
	demos := []demoSlot{
		{email: "suresh.gupta@smartca.in", as: "owner_ca"},
		{email: "rahul.joshi@smartca.in", as: "assignee"},
		{email: "arun.mehta@smartca.in", as: "assignee"},
		{email: "sanjay.verma@smartca.in", as: "assignee"},
	}
	active := demos[:0]
	for _, d := range demos {
		var uid string
		err := db.QueryRow(`SELECT id FROM users WHERE lower(data->>'email')=$1 AND archived=false LIMIT 1`, strings.ToLower(d.email)).Scan(&uid)
		if err != nil || uid == "" {
			log.Printf("  demo portfolio skip %s (user not in DB)", d.email)
			continue
		}
		d.uid = uid
		active = append(active, d)
	}
	if len(active) == 0 {
		return
	}

	cas := rosterByRole("ca")
	tls := rosterByRole("team_leader")
	executors := append(rosterByRole("junior_ca"), rosterByRole("employee")...)
	if len(cas) == 0 || len(tls) == 0 || len(executors) == 0 {
		return
	}
	const perUser = 40
	now := time.Now().UTC()
	workTypes := []string{"GSTR1", "GSTR3B", "ITR", "TDS", "ROC_AOC4", "AUDIT"}
	priorities := []string{"low", "medium", "high", "urgent"}
	risks := []string{"low", "medium", "high"}

	tx, err := db.Begin()
	must(err)
	stmt, err := tx.Prepare(`
		INSERT INTO wm_work_items (
			id, title, description, priority, status, due_date, created_date,
			assigned_by, assigned_to, client_id, client_name, department, tags,
			estimated_hours, actual_hours, completion_pct, parent_id, created_by, updated_by,
			created_at, updated_at,
			company_id, engagement_id, work_type, period_key, fy, overlay, risk_class,
			owner_ca_id, tl_id, assignee_id, delegated_close, requires_partner_signoff
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NULL,$17,$17,$18,$18,
			$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,false,false
		) ON CONFLICT (id) DO NOTHING`)
	must(err)
	defer stmt.Close()

	seq := 0
	for _, d := range active {
		for i := 1; i <= perUser; i++ {
			seq++
			slug := strings.ToUpper(strings.ReplaceAll(strings.Split(d.email, "@")[0], ".", ""))
			id := fmt.Sprintf("PRACTICE-WRK-DEMO-%s-%02d", slug, i)
			ca := cas[seq%len(cas)]
			tl := tls[seq%len(tls)]
			ex := executors[seq%len(executors)]
			ownerID, assigneeID := ca.ID, ex.ID
			switch d.as {
			case "owner_ca":
				ownerID = d.uid
			case "assignee":
				assigneeID = d.uid
			}
			cli := clients[seq%len(clients)]
			eng := engagements[seq%len(engagements)]
			wt := workTypes[seq%len(workTypes)]
			var cmp any
			periodKey := fmt.Sprintf("2025-%02d-D%04d", (seq%12)+1, seq)
			if seq%3 != 0 && len(companies) > 0 {
				cmp = companies[seq%len(companies)]
			}
			st := "IN_PROGRESS"
			if i%5 == 0 {
				st = "DOCUMENT_PENDING"
			} else if i%7 == 0 {
				st = "READY_FOR_CA_VERIFY"
			}
			title := fmt.Sprintf("%s — demo portfolio %s #%d", wt, d.email, i)
			_, err := stmt.Exec(
				id, title, "BUG-0012 demo USR portfolio for practice-role UAT",
				priorities[seq%len(priorities)], st, now.Add(time.Duration(i)*24*time.Hour), now,
				tl.ID, assigneeID, cli, cli, ca.Dept, pq.Array([]string{"practice_uat", "demo_portfolio", wt}),
				float64(4+(i%8)), float64(i%6), 25, ownerID, now,
				cmp, eng, wt, periodKey, "FY2025-26", "", risks[seq%len(risks)],
				ownerID, tl.ID, assigneeID,
			)
			must(err)
		}
		log.Printf("  demo portfolio %s → %s (%d works as %s)", d.email, d.uid, perUser, d.as)
	}
	must(tx.Commit())
}

func seedIntakes(db *sql.DB, roster []seedUser) {
	rcps := rosterByRole("reception")
	now := time.Now().UTC()
	for i := 1; i <= nIntakes; i++ {
		id := fmt.Sprintf("PRACTICE-INT-%04d", i)
		rcp := rcps[i%len(rcps)]
		st := "INTAKE"
		if i%3 == 0 {
			st = "APPROVED"
		} else if i%5 == 0 {
			st = "REJECTED"
		}
		svc := "GST"
		if i%2 == 0 {
			svc = "ITR"
		}
		_, err := db.Exec(`INSERT INTO wm_intakes (
			id, status, source, contact_name, contact_phone, contact_email, services, notes,
			created_by, created_at, updated_at
		) VALUES ($1,$2,'walk_in',$3,$4,$5,$6,$7,$8,$9,$9)
		ON CONFLICT (id) DO NOTHING`,
			id, st, fmt.Sprintf("Walk-in Contact %d", i), fmt.Sprintf("98%08d", 10000000+i),
			fmt.Sprintf("walkin%d@example.com", i), pq.Array([]string{svc}),
			"Practice UAT intake", rcp.ID, now)
		must(err)
	}
}

func printCounts(db *sql.DB) {
	queries := []struct {
		label, sql string
	}{
		{"users (PRACTICE-)", `SELECT COUNT(*) FROM users WHERE id LIKE 'PRACTICE-%'`},
		{"users roster named (excl pending)", `SELECT COUNT(*) FROM users WHERE id LIKE 'PRACTICE-%' AND id NOT LIKE 'PRACTICE-PEND-%'`},
		{"clients", `SELECT COUNT(*) FROM clients WHERE id LIKE 'PRACTICE-%'`},
		{"companies", `SELECT COUNT(*) FROM companies WHERE id LIKE 'PRACTICE-%'`},
		{"engagements", `SELECT COUNT(*) FROM wm_engagements WHERE id LIKE 'PRACTICE-%'`},
		{"works", `SELECT COUNT(*) FROM wm_work_items WHERE id LIKE 'PRACTICE-%'`},
		{"intakes", `SELECT COUNT(*) FROM wm_intakes WHERE id LIKE 'PRACTICE-%'`},
		{"HR-created works (expect 0)", `SELECT COUNT(*) FROM wm_work_items WHERE id LIKE 'PRACTICE-%' AND created_by LIKE 'PRACTICE-HR-%'`},
		{"users with reports_to (BUG-0007)", `SELECT COUNT(*) FROM users WHERE id LIKE 'PRACTICE-%' AND COALESCE(NULLIF(TRIM(data->>'reports_to'),''), NULLIF(TRIM(data->>'reportsTo'),'')) IS NOT NULL`},
	}
	for _, q := range queries {
		var n int
		_ = db.QueryRow(q.sql).Scan(&n)
		log.Printf("COUNT %s = %d", q.label, n)
	}
}

func verifyNamed(db *sql.DB) {
	for _, name := range []string{"Alok", "Nitesh", "Mukesh"} {
		var n int
		must(db.QueryRow(`SELECT COUNT(*) FROM users WHERE data->>'fullName' ILIKE $1`, "%"+name+"%").Scan(&n))
		if n == 0 {
			log.Fatalf("verify failed: %s count = 0", name)
		}
		log.Printf("VERIFY %s fullName matches = %d", name, n)
	}
}

// verifyRolePortfolios asserts BUG-0012 practice roles each have at least one visible work
// (senior_ca via owner_ca_id; junior/accountant/article via assignee_id).
func verifyRolePortfolios(db *sql.DB) {
	checks := []struct {
		label, email, sql string
	}{
		{"senior_ca practice", "vikram@practice.smartca.in",
			`SELECT COUNT(*) FROM wm_work_items w JOIN users u ON u.id=w.owner_ca_id WHERE lower(u.data->>'email')=$1 AND w.id LIKE 'PRACTICE-%'`},
		{"junior_ca practice", "aditya@practice.smartca.in",
			`SELECT COUNT(*) FROM wm_work_items w JOIN users u ON u.id=w.assignee_id WHERE lower(u.data->>'email')=$1 AND w.id LIKE 'PRACTICE-%'`},
		{"accountant practice", "ganesh@practice.smartca.in",
			`SELECT COUNT(*) FROM wm_work_items w JOIN users u ON u.id=w.assignee_id WHERE lower(u.data->>'email')=$1 AND w.id LIKE 'PRACTICE-%'`},
		{"article practice", "kunal@practice.smartca.in",
			`SELECT COUNT(*) FROM wm_work_items w JOIN users u ON u.id=w.assignee_id WHERE lower(u.data->>'email')=$1 AND w.id LIKE 'PRACTICE-%'`},
	}
	for _, c := range checks {
		var n int
		must(db.QueryRow(c.sql, c.email).Scan(&n))
		if n == 0 {
			log.Fatalf("BUG-0012 verify failed: %s (%s) portfolio = 0", c.label, c.email)
		}
		log.Printf("VERIFY portfolio %s (%s) = %d", c.label, c.email, n)
	}
}

func appendUnique(base []string, extra ...string) []string {
	seen := map[string]bool{}
	for _, p := range base {
		seen[p] = true
	}
	for _, p := range extra {
		if !seen[p] {
			base = append(base, p)
			seen[p] = true
		}
	}
	return base
}

func execIgnore(stmt *sql.Stmt, id string, data []byte) error {
	_, err := stmt.Exec(id, data)
	return err
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func loadDotEnv(path string) {
	b, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		k := strings.TrimSpace(parts[0])
		v := strings.TrimSpace(parts[1])
		if os.Getenv(k) == "" {
			_ = os.Setenv(k, v)
		}
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
