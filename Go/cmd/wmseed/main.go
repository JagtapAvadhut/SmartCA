package main

// wmseed wipes Work Management tables and loads realistic CA-office scale data.
// Usage (from Go/): go run ./cmd/wmseed
//
// Targets:
//   5 managers, 20 CA, 50 team leaders, 300 employees,
//   1000 clients, 5000 work items,
//   15000 notes, 12000 follow-ups, 8000 calls, 4000 emails,
//   3000 meetings, 20000 comments, 5000 attachments.

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	_ "github.com/lib/pq"
)

const (
	nManagers  = 5
	nCA        = 20
	nTL        = 50
	nEmployees = 300
	nClients   = 1000
	nWork      = 5000
	nNotes     = 15000
	nFollowups = 12000
	nCalls     = 8000
	nEmails    = 4000
	nMeetings  = 3000
	nComments  = 20000
	nAttach    = 5000
)

var passwordHash = "$2a$10$LfjRwo5HgMU/P2xEQMtaYu1PNHkOXL/ZrDAdhKG8Ob9j2XRw5i2la" // SmartCA@2025

func main() {
	loadDotEnv(".env")
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getenv("DB_HOST", "localhost"), getenv("DB_PORT", "5432"),
		getenv("DB_USER", "smartca"), os.Getenv("DB_PASSWORD"), getenv("DB_NAME", "smartca"))
	db, err := sql.Open("postgres", dsn)
	must(err)
	defer db.Close()
	must(db.Ping())

	log.Println("wiping work management data…")
	wipe(db)

	log.Println("seeding users / clients…")
	managers, cas, tls, emps := seedUsers(db)
	clients := seedClients(db)

	log.Println("seeding work items…")
	works := seedWork(db, managers, cas, tls, emps, clients)

	log.Println("seeding child logs…")
	seedChildren(db, works, append(append(append(managers, cas...), tls...), emps...))

	printCounts(db)
	log.Println("wmseed complete")
	log.Println("sample logins (password SmartCA@2025):")
	log.Println("  manager1@wm.smartca.in  ca1@wm.smartca.in  tl1@wm.smartca.in  emp1@wm.smartca.in")
}

func wipe(db *sql.DB) {
	stmts := []string{
		`DELETE FROM wm_notifications`,
		`DELETE FROM wm_audit`,
		`DELETE FROM wm_activity`,
		`DELETE FROM wm_attachments`,
		`DELETE FROM wm_comments`,
		`DELETE FROM wm_notes`,
		`DELETE FROM wm_meeting_logs`,
		`DELETE FROM wm_email_logs`,
		`DELETE FROM wm_call_logs`,
		`DELETE FROM wm_followups`,
		`DELETE FROM wm_work_items`,
		`DELETE FROM users WHERE id LIKE 'WM-%'`,
		`DELETE FROM clients WHERE id LIKE 'WM-CLT-%'`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Printf("wipe warn: %v (%s)", err, s)
		}
	}
}

func seedUsers(db *sql.DB) (managers, cas, tls, emps []string) {
	// Hierarchy: Manager → CA → TL → Emp (stable modulo pools match work pairing).
	insert := func(id, email, full, role, dept, reportsTo string) {
		perms := permsFor(role)
		data := map[string]any{
			"id": id, "email": email, "fullName": full, "role": role, "roleName": role,
			"department": dept, "status": "active", "passwordHash": passwordHash,
			"permissions": perms, "designation": role, "loginId": email,
			"reportsTo": reportsTo, "reports_to": reportsTo,
		}
		raw, _ := json.Marshal(data)
		_, err := db.Exec(`INSERT INTO users (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW())
			ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, archived=false, updated_at=NOW()`, id, raw)
		must(err)
	}
	for i := 1; i <= nManagers; i++ {
		id := fmt.Sprintf("WM-MGR-%04d", i)
		insert(id, fmt.Sprintf("manager%d@wm.smartca.in", i), fmt.Sprintf("Manager %d", i), "manager", "Leadership", "")
		managers = append(managers, id)
	}
	for i := 1; i <= nCA; i++ {
		id := fmt.Sprintf("WM-CA-%04d", i)
		mgr := managers[(i-1)%len(managers)]
		insert(id, fmt.Sprintf("ca%d@wm.smartca.in", i), fmt.Sprintf("CA %d", i), "ca", "Assurance", mgr)
		cas = append(cas, id)
	}
	for i := 1; i <= nTL; i++ {
		id := fmt.Sprintf("WM-TL-%04d", i)
		ca := cas[(i-1)%len(cas)]
		insert(id, fmt.Sprintf("tl%d@wm.smartca.in", i), fmt.Sprintf("Team Leader %d", i), "team_leader", "Operations", ca)
		tls = append(tls, id)
	}
	for i := 1; i <= nEmployees; i++ {
		id := fmt.Sprintf("WM-EMP-%04d", i)
		tl := tls[(i-1)%len(tls)]
		insert(id, fmt.Sprintf("emp%d@wm.smartca.in", i), fmt.Sprintf("Employee %d", i), "employee", []string{"GST", "ITR", "Audit", "ROC", "TDS"}[i%5], tl)
		emps = append(emps, id)
	}
	return
}

func permsFor(role string) []string {
	switch role {
	case "manager", "ca":
		return []string{"work.view", "work.create", "work.edit", "work.delete", "work.assign", "work.comment", "work.upload", "work.users.create", "work.audit.view", "work.dashboard.manage", "work.dashboard.mine", "dashboard.view", "clients.view"}
	case "team_leader":
		return []string{"work.view", "work.create", "work.edit", "work.assign", "work.comment", "work.upload", "work.users.create", "work.dashboard.mine", "dashboard.view"}
	default:
		return []string{"work.view", "work.edit", "work.comment", "work.upload", "work.dashboard.mine", "dashboard.view"}
	}
}

func seedClients(db *sql.DB) []string {
	ids := make([]string, 0, nClients)
	tx, err := db.Begin()
	must(err)
	stmt, err := tx.Prepare(`INSERT INTO clients (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW()) ON CONFLICT (id) DO NOTHING`)
	must(err)
	defer stmt.Close()
	for i := 1; i <= nClients; i++ {
		id := fmt.Sprintf("WM-CLT-%04d", i)
		data, _ := json.Marshal(map[string]any{
			"id": id, "name": fmt.Sprintf("Client Corp %d", i), "status": "active",
			"email": fmt.Sprintf("client%d@example.com", i), "city": []string{"Mumbai", "Pune", "Delhi", "Bengaluru"}[i%4],
		})
		_, err := stmt.Exec(id, data)
		must(err)
		ids = append(ids, id)
	}
	must(tx.Commit())
	return ids
}

func seedWork(db *sql.DB, managers, cas, tls, emps, clients []string) []string {
	priorities := []string{"low", "medium", "high", "urgent"}
	statuses := []string{"todo", "in_progress", "blocked", "review", "completed", "cancelled"}
	depts := []string{"GST", "ITR", "Audit", "ROC", "TDS", "Advisory"}
	ids := make([]string, 0, nWork)
	tx, err := db.Begin()
	must(err)
	stmt, err := tx.Prepare(`
		INSERT INTO wm_work_items (
			id, title, description, priority, status, due_date, created_date,
			assigned_by, assigned_to, client_id, client_name, department, tags,
			estimated_hours, actual_hours, completion_pct, parent_id, created_by, updated_by, created_at, updated_at,
			owner_ca_id, tl_id, assignee_id
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
		)`)
	must(err)
	defer stmt.Close()
	now := time.Now().UTC()
	var parentPool []string
	for i := 1; i <= nWork; i++ {
		id := uuid.Must(uuid.NewV7()).String()
		mgr := managers[i%len(managers)]
		ca := cas[i%len(cas)]
		tl := tls[i%len(tls)]
		emp := emps[(i/4)%len(emps)] // independent of i%4 so every employee gets work
		cli := clients[i%len(clients)]
		// Flow: Manager→CA, CA→TL, TL→Employee, Manager→Employee
		// Ownership triad (BC-P0-11): always set owner_ca + tl + assignee from the same
		// pool members used for this row (even when assigner/assignee are only a subset).
		var by, to, ownerCA, tlID, assigneeID string
		switch i % 4 {
		case 0: // Manager → CA
			by, to = mgr, ca
			ownerCA, tlID, assigneeID = ca, tl, ca
		case 1: // CA → TL
			by, to = ca, tl
			ownerCA, tlID, assigneeID = ca, tl, tl
		case 2: // TL → Employee
			by, to = tl, emp
			ownerCA, tlID, assigneeID = ca, tl, emp
		default: // Manager → Employee
			by, to = mgr, emp
			ownerCA, tlID, assigneeID = ca, tl, emp
		}
		var parent any
		if i%7 == 0 && len(parentPool) > 0 {
			parent = parentPool[i%len(parentPool)]
		} else {
			parent = nil
		}
		due := now.Add(time.Duration((i%60)-20) * 24 * time.Hour)
		st := statuses[i%len(statuses)]
		pct := 0
		if st == "completed" {
			pct = 100
		} else if st == "in_progress" {
			pct = 40 + (i % 50)
		}
		title := fmt.Sprintf("%s filing #%d", depts[i%len(depts)], i)
		_, err := stmt.Exec(
			id, title, "Seeded work for CA practice validation "+title, priorities[i%len(priorities)], st, due, now,
			by, to, cli, fmt.Sprintf("Client Corp %d", (i%nClients)+1), depts[i%len(depts)], pq.Array([]string{"seed", depts[i%len(depts)]}),
			float64(4+(i%20)), float64(i%15), pct, parent, by, by, now, now,
			ownerCA, tlID, assigneeID,
		)
		must(err)
		ids = append(ids, id)
		if i%7 != 0 {
			parentPool = append(parentPool, id)
			if len(parentPool) > 200 {
				parentPool = parentPool[len(parentPool)-200:]
			}
		}
		if i%500 == 0 {
			log.Printf("  work %d/%d", i, nWork)
		}
	}
	must(tx.Commit())
	return ids
}

func seedChildren(db *sql.DB, works, actors []string) {
	now := time.Now().UTC()
	batchExec := func(label string, n int, fn func(tx *sql.Tx, i int) error) {
		tx, err := db.Begin()
		must(err)
		for i := 1; i <= n; i++ {
			must(fn(tx, i))
			if i%2000 == 0 {
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
		_, err := tx.Exec(`INSERT INTO wm_followups (id, work_item_id, followup_date, created_by, notes, next_followup_date, reminder, created_at, updated_at)
			VALUES ($1,$2,$3::date,$4,$5,$6::date,$7,$8,$8)`,
			uuid.Must(uuid.NewV7()).String(), w, now.AddDate(0, 0, i%30).Format("2006-01-02"), a,
			fmt.Sprintf("Follow-up note %d", i), now.AddDate(0, 0, (i%30)+7).Format("2006-01-02"), i%2 == 0, now)
		return err
	})
	batchExec("calls", nCalls, func(tx *sql.Tx, i int) error {
		dir := "incoming"
		if i%2 == 0 {
			dir = "outgoing"
		}
		_, err := tx.Exec(`INSERT INTO wm_call_logs (id, work_item_id, call_date, direction, duration_minutes, person_spoken_to, designation, phone_number, summary, detailed_notes, action_items, created_by, created_at, updated_at)
			VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
			uuid.Must(uuid.NewV7()).String(), works[i%len(works)], now.AddDate(0, 0, -(i%40)).Format("2006-01-02"), dir, 5+(i%55),
			fmt.Sprintf("Contact %d", i%200), "CFO", fmt.Sprintf("98%08d", i%100000000), "Call summary", "Details", "Action", actors[i%len(actors)], now)
		return err
	})
	batchExec("emails", nEmails, func(tx *sql.Tx, i int) error {
		_, err := tx.Exec(`INSERT INTO wm_email_logs (id, work_item_id, email_date, from_addr, to_addr, cc_addr, subject, summary, attachments, status, created_by, created_at, updated_at)
			VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
			uuid.Must(uuid.NewV7()).String(), works[i%len(works)], now.AddDate(0, 0, -(i%20)).Format("2006-01-02"),
			"ops@smartca.in", fmt.Sprintf("client%d@example.com", i%nClients), "cc@smartca.in",
			fmt.Sprintf("Subject %d", i), "Email summary", pq.Array([]string{}), "sent", actors[i%len(actors)], now)
		return err
	})
	batchExec("meetings", nMeetings, func(tx *sql.Tx, i int) error {
		_, err := tx.Exec(`INSERT INTO wm_meeting_logs (id, work_item_id, meeting_date, location, online_link, participants, discussion_notes, decisions, action_items, created_by, created_at, updated_at)
			VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
			uuid.Must(uuid.NewV7()).String(), works[i%len(works)], now.AddDate(0, 0, i%25).Format("2006-01-02"),
			[]string{"Office", "Zoom", "Client site"}[i%3], "https://meet.example/"+uuid.NewString()[:8],
			pq.Array([]string{actors[i%len(actors)], actors[(i+1)%len(actors)]}),
			"Discussion", "Decision", "Actions", actors[i%len(actors)], now)
		return err
	})
	batchExec("notes", nNotes, func(tx *sql.Tx, i int) error {
		_, err := tx.Exec(`INSERT INTO wm_notes (id, work_item_id, body, format, attachment_ids, created_by, created_at, updated_at)
			VALUES ($1,$2,$3,'markdown',$4,$5,$6,$6)`,
			uuid.Must(uuid.NewV7()).String(), works[i%len(works)], fmt.Sprintf("## Note %d\n\nMarkdown body for work validation.", i),
			pq.Array([]string{}), actors[i%len(actors)], now)
		return err
	})
	batchExec("comments", nComments, func(tx *sql.Tx, i int) error {
		_, err := tx.Exec(`INSERT INTO wm_comments (id, work_item_id, body, mentions, created_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$6)`,
			uuid.Must(uuid.NewV7()).String(), works[i%len(works)], fmt.Sprintf("Internal comment %d @mention", i),
			pq.Array([]string{actors[(i+3)%len(actors)]}), actors[i%len(actors)], now)
		return err
	})
	batchExec("attachments", nAttach, func(tx *sql.Tx, i int) error {
		kinds := []string{"pdf", "excel", "word", "image", "zip"}
		names := []string{"doc.pdf", "sheet.xlsx", "letter.docx", "scan.png", "bundle.zip"}
		k := kinds[i%len(kinds)]
		_, err := tx.Exec(`INSERT INTO wm_attachments (id, work_item_id, file_name, content_type, size_bytes, storage_path, kind, uploaded_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
			uuid.Must(uuid.NewV7()).String(), works[i%len(works)], names[i%len(names)], "application/octet-stream", int64(1024*(i%500+1)),
			fmt.Sprintf("/uploads/work/%s", uuid.NewString()), k, actors[i%len(actors)], now)
		return err
	})

	// Activity + audit samples (one per work for coverage)
	tx, err := db.Begin()
	must(err)
	for i, w := range works {
		if i >= 5000 {
			break
		}
		a := actors[i%len(actors)]
		_, _ = tx.Exec(`INSERT INTO wm_activity (id, work_item_id, action, summary, actor_id, actor_name, metadata, created_at)
			VALUES ($1,$2,'created',$3,$4,$5,'{}',$6)`, uuid.Must(uuid.NewV7()).String(), w, "Seed created", a, a, now)
		_, _ = tx.Exec(`INSERT INTO wm_audit (id, work_item_id, entity_type, entity_id, field_name, old_value, new_value, user_id, ip_address, user_agent, created_at)
			VALUES ($1,$2,'work_item',$2,'status','','todo',$3,'127.0.0.1','wmseed',$4)`, uuid.Must(uuid.NewV7()).String(), w, a, now)
		if i%1000 == 0 && i > 0 {
			must(tx.Commit())
			tx, err = db.Begin()
			must(err)
		}
	}
	must(tx.Commit())
}

func printCounts(db *sql.DB) {
	tables := []string{
		"wm_work_items", "wm_notes", "wm_followups", "wm_call_logs", "wm_email_logs",
		"wm_meeting_logs", "wm_comments", "wm_attachments", "wm_activity", "wm_audit",
	}
	for _, t := range tables {
		var n int
		_ = db.QueryRow("SELECT COUNT(*) FROM " + t).Scan(&n)
		log.Printf("COUNT %s = %d", t, n)
	}
	var u, c int
	_ = db.QueryRow(`SELECT COUNT(*) FROM users WHERE id LIKE 'WM-%'`).Scan(&u)
	_ = db.QueryRow(`SELECT COUNT(*) FROM clients WHERE id LIKE 'WM-CLT-%'`).Scan(&c)
	log.Printf("COUNT WM users = %d", u)
	log.Printf("COUNT WM clients = %d", c)
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
