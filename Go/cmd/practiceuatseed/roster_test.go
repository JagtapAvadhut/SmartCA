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
