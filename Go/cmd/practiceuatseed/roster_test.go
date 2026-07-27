package main

import (
	"strings"
	"testing"
)

func TestPracticeRoster_Exactly55Named(t *testing.T) {
	roster := practiceRoster()
	if len(roster) != 55 {
		t.Fatalf("want 55 named users, got %d", len(roster))
	}
	seenID := map[string]bool{}
	seenEmail := map[string]bool{}
	for _, u := range roster {
		if u.ID == "" || !strings.HasPrefix(u.ID, "PRACTICE-") {
			t.Fatalf("bad id %q", u.ID)
		}
		if !strings.HasSuffix(u.Email, "@practice.smartca.in") {
			t.Fatalf("bad email %q", u.Email)
		}
		if seenID[u.ID] {
			t.Fatalf("duplicate id %s", u.ID)
		}
		if seenEmail[u.Email] {
			t.Fatalf("duplicate email %s", u.Email)
		}
		seenID[u.ID] = true
		seenEmail[u.Email] = true
		if u.Role == "" || u.FullName == "" {
			t.Fatalf("incomplete user %+v", u)
		}
	}
	mustContain := []string{"Alok Joshi", "Nitesh Sharma", "Mukesh Verma", "Vamsi Reddy", "Anudeep Rao", "Amit Joshi", "Sneha Patil", "Shruti Pawar", "Anita Desai"}
	for _, name := range mustContain {
		found := false
		for _, u := range roster {
			if u.FullName == name {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("missing named persona %s", name)
		}
	}
	roles := map[string]int{}
	for _, u := range roster {
		roles[u.Role]++
	}
	for _, role := range []string{"partner", "manager", "ca", "senior_ca", "team_leader", "junior_ca", "article_assistant", "accountant", "employee", "hr", "reception", "admin"} {
		if roles[role] == 0 {
			t.Fatalf("role %s missing from roster", role)
		}
	}
	if roles["manager"] != 1 {
		t.Fatalf("want exactly 1 manager (Alok), got %d", roles["manager"])
	}
}

func TestPracticeRoster_ReportsToTree(t *testing.T) {
	roster := practiceRoster()
	byID := map[string]seedUser{}
	for _, u := range roster {
		byID[u.ID] = u
	}
	var withReports int
	for _, u := range roster {
		if u.ReportsTo == "" {
			continue
		}
		withReports++
		if _, ok := byID[u.ReportsTo]; !ok {
			t.Fatalf("%s reportsTo %s not in roster", u.ID, u.ReportsTo)
		}
	}
	if withReports < 40 {
		t.Fatalf("expected most practice users to have reportsTo, got %d", withReports)
	}
	if byID["PRACTICE-CA-NITESH"].ReportsTo != "PRACTICE-MGR-ALOK" {
		t.Fatal("CA Nitesh should report to Alok")
	}
	if byID["PRACTICE-TL-MUKESH"].ReportsTo != "PRACTICE-CA-NITESH" {
		t.Fatal("TL Mukesh should report to CA Nitesh")
	}
	if byID["PRACTICE-EMP-01"].ReportsTo != "PRACTICE-TL-MUKESH" {
		t.Fatal("Emp Amol should report to TL Mukesh")
	}
}
