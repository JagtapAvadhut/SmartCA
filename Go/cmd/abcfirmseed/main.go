// abcfirmseed loads ABC Professional Services LLP purchase-UAT data.
//
// Usage (from Go/):
//
//	go run ./cmd/abcfirmseed
//
// Env: DB_HOST=localhost DB_PORT=5432 DB_USER=smartca DB_PASSWORD=yourpassword DB_NAME=smartca
//
// Idempotent: wipes ONLY ABC-* rows and @abc.smartca.in users.
// Does NOT touch WM-*, PRACTICE-*, or demo USR-* data.
//
// Password for all ABC users: SmartCA@2025
package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
	"github.com/google/uuid"
	"github.com/lib/pq"
	_ "github.com/lib/pq"
)

const (
	nClients     = 100
	nWorks       = 900
	nIntakes     = 40
	nFollowups   = 1200
	nCalls       = 1000
	nEmails      = 900
	nMeetings    = 600
	nNotes       = 1500
	nComments    = 1800
	nAttach      = 500
	nTransitions = 800
	passwordHash = "$2a$10$LfjRwo5HgMU/P2xEQMtaYu1PNHkOXL/ZrDAdhKG8Ob9j2XRw5i2la" // SmartCA@2025
	emailDomain  = "@abc.smartca.in"
	idPrefix     = "ABC-"
	orgName      = "ABC Professional Services LLP"
)

var entityTypes = []string{
	"Pvt Ltd", "LLP", "Partnership", "Proprietorship", "Trust", "NGO", "Individual",
}

var engagementServices = []string{
	"GST", "TDS", "ITR", "ROC", "Accounting", "Payroll", "Audit",
	"Incorporation", "Compliance", "Notices", "Appeals",
}

var clientCities = []string{
	"Pune", "Mumbai", "Nagpur", "Nashik", "Bengaluru", "Delhi", "Hyderabad", "Ahmedabad", "Chennai", "Indore",
}

var clientNameStems = []string{
	"Horizon", "Bright", "Zenith", "Summit", "Nexus", "Vertex", "Apex", "Prime", "Nova", "Orbit",
	"Saffron", "Indigo", "Cedar", "Maple", "Lotus", "Pearl", "Coral", "Amber", "Silver", "Golden",
	"Metro", "Urban", "Coastal", "Valley", "Ridge", "Harbor", "Bridge", "Crown", "Eagle", "Falcon",
	"Shree", "Omkar", "Sai", "Ganesh", "Lakshmi", "Krishna", "Bharat", "Arya", "Veda", "Surya",
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

	roster := abcRoster()
	if len(roster) != 50 {
		log.Fatalf("ABC roster must be exactly 50 users, got %d", len(roster))
	}

	log.Println("wiping ABC firm ids only (ABC-* / @abc.smartca.in)…")
	wipeABC(db)

	log.Println("seeding 50 ABC users…")
	seedUsers(db, roster)

	log.Println("seeding 100 clients + companies (1–10 each) + engagements…")
	clients := seedClients(db)
	companies := seedCompanies(db, clients)
	engagements := seedEngagements(db, clients, companies, roster)

	log.Println("seeding ~900 works across ~6 months…")
	works := seedWorks(db, clients, companies, engagements, roster)

	log.Println("seeding intakes…")
	seedIntakes(db, roster)

	log.Println("seeding child ops (notes/calls/emails/meetings/followups/…)…")
	seedChildren(db, works, roster)

	printCounts(db)
	verifyHierarchy(db, roster)
	log.Println("abcfirmseed complete")
	log.Println("password: SmartCA@2025")
	log.Println("key logins:")
	log.Println("  managing.partner@abc.smartca.in")
	log.Println("  partner1@abc.smartca.in / partner2@abc.smartca.in")
	log.Println("  practice.manager@abc.smartca.in")
	log.Println("  ca1@abc.smartca.in … ca5@abc.smartca.in")
	log.Println("  tl1@abc.smartca.in … tl8@abc.smartca.in")
	log.Println("  emp1@abc.smartca.in … emp31@abc.smartca.in")
	log.Println("  hr@abc.smartca.in / reception@abc.smartca.in")
}

func wipeABC(db *sql.DB) {
	childDeletes := []string{
		`DELETE FROM wm_notifications WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_audit WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_activity WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_attachments WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_comments WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_notes WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_meeting_logs WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_email_logs WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_call_logs WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_followups WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_checklist_items WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_work_transitions WHERE work_item_id LIKE 'ABC-%'`,
		`DELETE FROM wm_work_items WHERE id LIKE 'ABC-%'`,
		`DELETE FROM wm_intakes WHERE id LIKE 'ABC-%'`,
		`DELETE FROM wm_engagements WHERE id LIKE 'ABC-%'`,
		`DELETE FROM companies WHERE id LIKE 'ABC-%'`,
		`DELETE FROM clients WHERE id LIKE 'ABC-%'`,
		`DELETE FROM users WHERE id LIKE 'ABC-%' OR lower(data->>'email') LIKE '%` + emailDomain + `'`,
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
		perms = appendUnique(perms, "dashboard.view", "clients.view", "companies.view")
		parts := strings.Fields(u.FullName)
		first := parts[0]
		data := map[string]any{
			"id":           u.ID,
			"email":        u.Email,
			"fullName":     u.FullName,
			"firstName":    first,
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
			"seed":         "abc_firm_uat",
		}
		if u.Role == "hr" {
			data["placementStatus"] = "ACTIVE"
		}
		raw, _ := json.Marshal(data)
		_, err := db.Exec(`INSERT INTO users (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW())
			ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, archived=false, updated_at=NOW()`, u.ID, raw)
		must(err)
	}
}

func seedClients(db *sql.DB) []clientRec {
	out := make([]clientRec, 0, nClients)
	tx, err := db.Begin()
	must(err)
	stmt, err := tx.Prepare(`INSERT INTO clients (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
	must(err)
	defer stmt.Close()

	for i := 1; i <= nClients; i++ {
		id := fmt.Sprintf("ABC-CLT-%04d", i)
		stem := clientNameStems[(i-1)%len(clientNameStems)]
		et := entityTypes[(i-1)%len(entityTypes)]
		name := fmt.Sprintf("%s %s %s", stem, []string{"Traders", "Enterprises", "Holdings", "Services", "Industries", "Consulting", "Labs", "Foods"}[i%8], et)
		if et == "Individual" {
			name = fmt.Sprintf("%s Family (Individual)", stem)
		}
		city := clientCities[i%len(clientCities)]
		data, _ := json.Marshal(map[string]any{
			"id": id, "name": name, "status": "active", "city": city,
			"entityType": et, "email": fmt.Sprintf("client%d@example.com", i),
			"phone": fmt.Sprintf("98%08d", 20000000+i),
			"seed": "abc_firm_uat", "organization": orgName,
		})
		must(execIgnore(stmt, id, data))
		// 1–10 companies per client (deterministic)
		nCo := 1 + (i*7)%10
		out = append(out, clientRec{ID: id, Name: name, EntityType: et, NCompanies: nCo})
	}
	must(tx.Commit())
	return out
}

type clientRec struct {
	ID, Name, EntityType string
	NCompanies           int
}

func seedCompanies(db *sql.DB, clients []clientRec) []string {
	ids := make([]string, 0, 400)
	tx, err := db.Begin()
	must(err)
	stmt, err := tx.Prepare(`INSERT INTO companies (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
	must(err)
	defer stmt.Close()

	seq := 0
	for _, c := range clients {
		n := c.NCompanies
		if c.EntityType == "Individual" {
			n = 1 // still one legal entity shell for ITR/compliance
		}
		for j := 1; j <= n; j++ {
			seq++
			id := fmt.Sprintf("ABC-CMP-%04d", seq)
			et := entityTypes[(seq-1)%len(entityTypes)]
			if c.EntityType == "Individual" {
				et = "Individual"
			}
			name := fmt.Sprintf("%s — Unit %d (%s)", c.Name, j, et)
			data, _ := json.Marshal(map[string]any{
				"id": id, "clientId": c.ID, "name": name, "status": "active",
				"entityType": et, "industry": []string{"Manufacturing", "IT", "Trading", "Services", "Healthcare", "Real Estate"}[seq%6],
				"seed": "abc_firm_uat", "organization": orgName,
			})
			must(execIgnore(stmt, id, data))
			ids = append(ids, id)
		}
	}
	must(tx.Commit())
	log.Printf("  companies seeded = %d", len(ids))
	return ids
}

func seedEngagements(db *sql.DB, clients []clientRec, companies []string, roster []seedUser) []string {
	cas := rosterByRole("ca")
	// ~2 engagements per client on average
	nEng := nClients * 2
	ids := make([]string, 0, nEng)
	tx, err := db.Begin()
	must(err)
	now := time.Now().UTC()
	for i := 1; i <= nEng; i++ {
		id := fmt.Sprintf("ABC-ENG-%04d", i)
		cli := clients[i%len(clients)]
		var cmp any
		if i%4 != 0 && len(companies) > 0 {
			cmp = companies[i%len(companies)]
		}
		ca := cas[i%len(cas)]
		svc := engagementServices[i%len(engagementServices)]
		svcs := pq.Array([]string{svc, engagementServices[(i+3)%len(engagementServices)]})
		_, err := tx.Exec(`INSERT INTO wm_engagements (
			id, client_id, company_id, owner_ca_id, services, status, fy, title, created_by, updated_by, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,'ACTIVE','FY2025-26',$6,$7,$7,$8,$8)
		ON CONFLICT (id) DO NOTHING`,
			id, cli.ID, cmp, ca.ID, svcs, fmt.Sprintf("%s retainer — %s", svc, cli.Name), idPM, now)
		must(err)
		ids = append(ids, id)
	}
	must(tx.Commit())
	return ids
}

func seedWorks(db *sql.DB, clients []clientRec, companies, engagements []string, roster []seedUser) []string {
	tls := rosterByRole("team_leader")
	emps := rosterByRole("employee")
	cas := rosterByRole("ca")

	statuses := []string{
		"OPEN", "DOCUMENT_PENDING", "DOCUMENT_RECEIVED", "IN_PROGRESS", "BLOCKED",
		"READY_FOR_TL_VERIFY", "TL_VERIFIED", "READY_FOR_CA_VERIFY", "CA_VERIFIED",
		"READY_FOR_MANAGER_CLOSE", "DELIVERED", "CLOSED",
	}
	statusPick := func(i int) string {
		switch i % 24 {
		case 0, 1, 2, 3, 4:
			return "DOCUMENT_PENDING"
		case 5, 6, 7:
			return "IN_PROGRESS"
		case 8, 9:
			return "READY_FOR_TL_VERIFY"
		case 10, 11:
			return "READY_FOR_CA_VERIFY"
		case 12:
			return "READY_FOR_MANAGER_CLOSE"
		case 13, 14:
			return "CLOSED"
		case 15:
			return "DELIVERED"
		case 16:
			return "BLOCKED"
		default:
			return statuses[i%len(statuses)]
		}
	}
	workTypes := []string{
		"GSTR1", "GSTR3B", "ITR", "TDS", "ROC_AOC4", "AUDIT", "PAYROLL",
		"ACCOUNTING", "COMPLIANCE", "NOTICE", "APPEAL", "INCORPORATION",
	}
	overlays := []string{"GST_MONTH", "ITR", "ROC", "NOTICE", "TDS", ""}
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
	ids := make([]string, 0, nWorks)

	// Emp → TL map for realistic assignment
	empByTL := map[string][]seedUser{}
	for _, e := range emps {
		empByTL[e.ReportsTo] = append(empByTL[e.ReportsTo], e)
	}

	for i := 1; i <= nWorks; i++ {
		id := fmt.Sprintf("ABC-WRK-%04d", i)
		tl := tls[i%len(tls)]
		ca := caForTL(tl.ID)
		if ca.ID == "" {
			ca = cas[i%len(cas)]
		}
		pool := empByTL[tl.ID]
		var ex seedUser
		if len(pool) > 0 {
			ex = pool[i%len(pool)]
		} else {
			ex = emps[i%len(emps)]
		}
		cli := clients[i%len(clients)]
		eng := engagements[i%len(engagements)]
		wt := workTypes[i%len(workTypes)]
		var cmp any
		periodKey := fmt.Sprintf("2025-%02d-A%04d", (i%12)+1, i)
		if i%3 != 0 && len(companies) > 0 {
			cmp = companies[i%len(companies)]
		}
		st := statusPick(i)
		pct := 0
		if st == "CLOSED" || st == "DELIVERED" {
			pct = 100
		} else if st == "IN_PROGRESS" {
			pct = 20 + (i % 60)
		} else if strings.Contains(st, "VERIFY") || st == "CA_VERIFIED" || st == "TL_VERIFIED" {
			pct = 70 + (i % 25)
		}
		risk := risks[i%len(risks)]
		partnerFlag := risk == "high" && i%9 == 0
		// Spread created_at across ~6 months
		createdAt := now.AddDate(0, 0, -((i*17)%180))
		due := createdAt.Add(time.Duration(7+(i%21)) * 24 * time.Hour)
		title := fmt.Sprintf("%s — %s #%d", wt, cli.Name, i)
		_, err := stmt.Exec(
			id, title, "ABC Professional Services LLP — purchase UAT work spanning FY delivery cycle",
			priorities[i%len(priorities)], st, due, createdAt,
			tl.ID, ex.ID, cli.ID, cli.Name, ca.Dept, pq.Array([]string{"abc_firm_uat", wt}),
			float64(4+(i%16)), float64(i%12), pct, ca.ID, createdAt,
			cmp, eng, wt, periodKey, "FY2025-26", overlays[i%len(overlays)], risk,
			ca.ID, tl.ID, ex.ID, partnerFlag,
		)
		must(err)
		ids = append(ids, id)
		if i%150 == 0 {
			log.Printf("  work %d/%d", i, nWorks)
		}
	}
	must(tx.Commit())

	// Reopen simulation: a handful of CLOSED works get activity notes later via children;
	// also create a few explicitly reopened (status IN_PROGRESS with tag).
	return ids
}

func seedIntakes(db *sql.DB, roster []seedUser) {
	_ = roster
	rcp := findUser(idRCP)
	now := time.Now().UTC()
	for i := 1; i <= nIntakes; i++ {
		id := fmt.Sprintf("ABC-INT-%04d", i)
		st := "INTAKE"
		if i%4 == 0 {
			st = "APPROVED"
		} else if i%7 == 0 {
			st = "REJECTED"
		}
		svc := engagementServices[i%len(engagementServices)]
		created := now.AddDate(0, 0, -((i*3)%90))
		_, err := db.Exec(`INSERT INTO wm_intakes (
			id, status, source, contact_name, contact_phone, contact_email, services, notes,
			created_by, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
		ON CONFLICT (id) DO NOTHING`,
			id, st, []string{"walk_in", "phone", "email", "referral"}[i%4],
			fmt.Sprintf("Walk-in Prospect %d", i), fmt.Sprintf("97%08d", 30000000+i),
			fmt.Sprintf("prospect%d@example.com", i), pq.Array([]string{svc}),
			"ABC firm front-desk intake", rcp.ID, created)
		must(err)
	}
}

func seedChildren(db *sql.DB, works []string, roster []seedUser) {
	actors := make([]string, 0, len(roster))
	for _, u := range roster {
		if u.Role != "hr" {
			actors = append(actors, u.ID)
		}
	}
	now := time.Now().UTC()
	batchExec := func(label string, n int, fn func(tx *sql.Tx, i int) error) {
		tx, err := db.Begin()
		must(err)
		for i := 1; i <= n; i++ {
			must(fn(tx, i))
			if i%500 == 0 {
				must(tx.Commit())
				tx, err = db.Begin()
				must(err)
				log.Printf("  %s %d/%d", label, i, n)
			}
		}
		must(tx.Commit())
	}

	batchExec("followups", nFollowups, func(tx *sql.Tx, i int) error {
		w := works[i%len(works)]
		a := actors[i%len(actors)]
		d := now.AddDate(0, 0, -((i*2)%150)+(i%20))
		_, err := tx.Exec(`INSERT INTO wm_followups (id, work_item_id, followup_date, created_by, notes, next_followup_date, reminder, created_at, updated_at)
			VALUES ($1,$2,$3::date,$4,$5,$6::date,$7,$8,$8)`,
			"ABC-FU-"+uuid.NewString()[:12], w, d.Format("2006-01-02"), a,
			fmt.Sprintf("Client follow-up #%d — documents / confirmation", i),
			d.AddDate(0, 0, 7).Format("2006-01-02"), i%2 == 0, d)
		return err
	})
	batchExec("calls", nCalls, func(tx *sql.Tx, i int) error {
		dir := "incoming"
		if i%2 == 0 {
			dir = "outgoing"
		}
		d := now.AddDate(0, 0, -((i*3)%160))
		_, err := tx.Exec(`INSERT INTO wm_call_logs (id, work_item_id, call_date, direction, duration_minutes, person_spoken_to, designation, phone_number, summary, detailed_notes, action_items, created_by, created_at, updated_at)
			VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
			"ABC-CL-"+uuid.NewString()[:12], works[i%len(works)], d.Format("2006-01-02"), dir, 5+(i%40),
			fmt.Sprintf("Client Contact %d", i%180), []string{"CFO", "Accountant", "Director", "Proprietor"}[i%4],
			fmt.Sprintf("98%08d", i%100000000), "Discussed pending docs / filing timeline",
			"Detailed call notes for ABC UAT", "Send reminder email", actors[i%len(actors)], d)
		return err
	})
	batchExec("emails", nEmails, func(tx *sql.Tx, i int) error {
		d := now.AddDate(0, 0, -((i*2)%170))
		_, err := tx.Exec(`INSERT INTO wm_email_logs (id, work_item_id, email_date, from_addr, to_addr, cc_addr, subject, summary, attachments, status, created_by, created_at, updated_at)
			VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
			"ABC-EM-"+uuid.NewString()[:12], works[i%len(works)], d.Format("2006-01-02"),
			"ops@abc.smartca.in", fmt.Sprintf("client%d@example.com", i%nClients+1), "practice.manager@abc.smartca.in",
			fmt.Sprintf("Re: Filing / docs request #%d", i), "Email summary — ABC delivery correspondence",
			pq.Array([]string{}), "sent", actors[i%len(actors)], d)
		return err
	})
	batchExec("meetings", nMeetings, func(tx *sql.Tx, i int) error {
		d := now.AddDate(0, 0, -((i*4)%160))
		_, err := tx.Exec(`INSERT INTO wm_meeting_logs (id, work_item_id, meeting_date, location, online_link, participants, discussion_notes, decisions, action_items, created_by, created_at, updated_at)
			VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
			"ABC-MT-"+uuid.NewString()[:12], works[i%len(works)], d.Format("2006-01-02"),
			[]string{"Pune office", "Zoom", "Client site", "Mumbai office"}[i%4],
			"https://meet.example/abc-"+uuid.NewString()[:8],
			pq.Array([]string{actors[i%len(actors)], actors[(i+1)%len(actors)]}),
			"Reviewed status, blockers, and delivery plan", "Proceed with filing after TL verify",
			"Collect bank statements; schedule CA review", actors[i%len(actors)], d)
		return err
	})
	batchExec("notes", nNotes, func(tx *sql.Tx, i int) error {
		d := now.AddDate(0, 0, -((i*2)%175))
		_, err := tx.Exec(`INSERT INTO wm_notes (id, work_item_id, body, format, attachment_ids, created_by, created_at, updated_at)
			VALUES ($1,$2,$3,'markdown',$4,$5,$6,$6)`,
			"ABC-NT-"+uuid.NewString()[:12], works[i%len(works)],
			fmt.Sprintf("## Internal note #%d\n\nWorking paper remark for ABC UAT delivery file.", i),
			pq.Array([]string{}), actors[i%len(actors)], d)
		return err
	})
	batchExec("comments", nComments, func(tx *sql.Tx, i int) error {
		d := now.AddDate(0, 0, -((i)%170))
		_, err := tx.Exec(`INSERT INTO wm_comments (id, work_item_id, body, mentions, created_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$6)`,
			"ABC-CM-"+uuid.NewString()[:12], works[i%len(works)],
			fmt.Sprintf("Thread comment #%d — please check docs / status", i),
			pq.Array([]string{actors[(i+3)%len(actors)]}), actors[i%len(actors)], d)
		return err
	})
	batchExec("attachments", nAttach, func(tx *sql.Tx, i int) error {
		kinds := []string{"pdf", "excel", "word", "image", "zip"}
		names := []string{"gstr.pdf", "books.xlsx", "noc.docx", "scan.png", "bundle.zip"}
		d := now.AddDate(0, 0, -((i*5)%160))
		_, err := tx.Exec(`INSERT INTO wm_attachments (id, work_item_id, file_name, content_type, size_bytes, storage_path, kind, uploaded_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
			"ABC-AT-"+uuid.NewString()[:12], works[i%len(works)], names[i%len(names)], "application/octet-stream",
			int64(1024*(i%400+1)), fmt.Sprintf("/uploads/abc/%s", uuid.NewString()), kinds[i%len(kinds)],
			actors[i%len(actors)], d)
		return err
	})

	// Transitions + activity + audit (simulate reassignments / status moves)
	tx, err := db.Begin()
	must(err)
	for i := 1; i <= nTransitions && i <= len(works); i++ {
		w := works[i%len(works)]
		a := actors[i%len(actors)]
		from := []string{"OPEN", "DOCUMENT_PENDING", "IN_PROGRESS", "READY_FOR_TL_VERIFY"}[i%4]
		to := []string{"IN_PROGRESS", "DOCUMENT_RECEIVED", "READY_FOR_TL_VERIFY", "TL_VERIFIED"}[i%4]
		d := now.AddDate(0, 0, -((i*3)%150))
		_, _ = tx.Exec(`INSERT INTO wm_work_transitions (id, work_item_id, from_status, to_status, actor_id, remarks, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
			"ABC-TR-"+uuid.NewString()[:12], w, from, to, a, "ABC UAT status move / reassignment trail", d)
		_, _ = tx.Exec(`INSERT INTO wm_activity (id, work_item_id, action, summary, actor_id, actor_name, metadata, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,'{}',$7)`,
			"ABC-AC-"+uuid.NewString()[:12], w, []string{"created", "assigned", "note_added", "status_changed", "reopened"}[i%5],
			fmt.Sprintf("ABC activity #%d", i), a, a, d)
		_, _ = tx.Exec(`INSERT INTO wm_audit (id, work_item_id, entity_type, entity_id, field_name, old_value, new_value, user_id, ip_address, user_agent, created_at)
			VALUES ($1,$2,'work_item',$2,'status',$3,$4,$5,'127.0.0.1','abcfirmseed',$6)`,
			"ABC-AU-"+uuid.NewString()[:12], w, from, to, a, d)
		if i%200 == 0 {
			must(tx.Commit())
			tx, err = db.Begin()
			must(err)
		}
	}
	must(tx.Commit())
}

func printCounts(db *sql.DB) {
	queries := []struct {
		label, sql string
	}{
		{"users ABC", `SELECT COUNT(*) FROM users WHERE id LIKE 'ABC-%'`},
		{"clients ABC", `SELECT COUNT(*) FROM clients WHERE id LIKE 'ABC-%'`},
		{"companies ABC", `SELECT COUNT(*) FROM companies WHERE id LIKE 'ABC-%'`},
		{"engagements ABC", `SELECT COUNT(*) FROM wm_engagements WHERE id LIKE 'ABC-%'`},
		{"works ABC", `SELECT COUNT(*) FROM wm_work_items WHERE id LIKE 'ABC-%'`},
		{"intakes ABC", `SELECT COUNT(*) FROM wm_intakes WHERE id LIKE 'ABC-%'`},
		{"notes ABC", `SELECT COUNT(*) FROM wm_notes WHERE id LIKE 'ABC-%'`},
		{"calls ABC", `SELECT COUNT(*) FROM wm_call_logs WHERE id LIKE 'ABC-%'`},
		{"emails ABC", `SELECT COUNT(*) FROM wm_email_logs WHERE id LIKE 'ABC-%'`},
		{"meetings ABC", `SELECT COUNT(*) FROM wm_meeting_logs WHERE id LIKE 'ABC-%'`},
		{"followups ABC", `SELECT COUNT(*) FROM wm_followups WHERE id LIKE 'ABC-%'`},
		{"comments ABC", `SELECT COUNT(*) FROM wm_comments WHERE id LIKE 'ABC-%'`},
		{"attachments ABC", `SELECT COUNT(*) FROM wm_attachments WHERE id LIKE 'ABC-%'`},
		{"activity ABC", `SELECT COUNT(*) FROM wm_activity WHERE id LIKE 'ABC-%'`},
		{"WM users untouched", `SELECT COUNT(*) FROM users WHERE id LIKE 'WM-%'`},
		{"PRACTICE users untouched", `SELECT COUNT(*) FROM users WHERE id LIKE 'PRACTICE-%'`},
	}
	for _, q := range queries {
		var n int
		_ = db.QueryRow(q.sql).Scan(&n)
		log.Printf("COUNT %s = %d", q.label, n)
	}
}

func verifyHierarchy(db *sql.DB, roster []seedUser) {
	for _, u := range roster {
		if u.ReportsTo == "" {
			continue
		}
		var n int
		must(db.QueryRow(`SELECT COUNT(*) FROM users WHERE id=$1 AND (
			COALESCE(NULLIF(TRIM(data->>'reports_to'),''), NULLIF(TRIM(data->>'reportsTo'),'')) = $2
		)`, u.ID, u.ReportsTo).Scan(&n))
		if n != 1 {
			log.Fatalf("hierarchy verify failed for %s → %s", u.ID, u.ReportsTo)
		}
	}
	log.Printf("VERIFY hierarchy OK for %d users with reports_to", countWithReports(roster))
	var roleCounts string
	_ = db.QueryRow(`
		SELECT string_agg(role || '=' || cnt::text, ', ' ORDER BY role) FROM (
			SELECT data->>'role' AS role, COUNT(*) AS cnt FROM users WHERE id LIKE 'ABC-%' GROUP BY 1
		) s`).Scan(&roleCounts)
	log.Printf("VERIFY role mix: %s", roleCounts)
}

func countWithReports(roster []seedUser) int {
	n := 0
	for _, u := range roster {
		if u.ReportsTo != "" {
			n++
		}
	}
	return n
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
