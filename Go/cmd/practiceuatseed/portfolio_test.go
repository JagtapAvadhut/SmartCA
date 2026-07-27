package main

import "testing"

// TestPracticeRoster_RolePortfolioCoverage asserts BUG-0012 seed inputs:
// senior_ca / junior_ca / accountant / article_assistant exist and are used in work assignment pools.
func TestPracticeRoster_RolePortfolioCoverage(t *testing.T) {
	scas := rosterByRole("senior_ca")
	jcas := rosterByRole("junior_ca")
	accs := rosterByRole("accountant")
	arts := rosterByRole("article_assistant")
	if len(scas) == 0 || len(jcas) == 0 || len(accs) == 0 || len(arts) == 0 {
		t.Fatalf("missing practice roles: sca=%d jca=%d acc=%d art=%d", len(scas), len(jcas), len(accs), len(arts))
	}

	// Mirror seedWorks owner pick: every 5th work → senior_ca owner.
	nWorksLocal := 500
	ownerHits := map[string]int{}
	for i := 1; i <= nWorksLocal; i++ {
		if i%5 == 0 {
			ownerHits[scas[i%len(scas)].ID]++
		}
	}
	for _, s := range scas {
		if ownerHits[s.ID] == 0 {
			t.Fatalf("senior_ca %s would get 0 owner portfolio from seedWorks rotation", s.Email)
		}
	}

	executors := append(append(jcas, arts...), accs...)
	executors = append(executors, rosterByRole("employee")...)
	assigneeHits := map[string]int{}
	for i := 1; i <= nWorksLocal; i++ {
		assigneeHits[executors[i%len(executors)].ID]++
	}
	for _, u := range append(append(jcas, arts...), accs...) {
		if assigneeHits[u.ID] == 0 {
			t.Fatalf("executor %s (%s) would get 0 assignee portfolio", u.Email, u.Role)
		}
	}

	// Preferred UAT emails documented for QA.
	wantEmails := map[string]string{
		"vikram@practice.smartca.in": "senior_ca",
		"aditya@practice.smartca.in": "junior_ca",
		"ganesh@practice.smartca.in": "accountant",
		"kunal@practice.smartca.in":  "article_assistant",
	}
	byEmail := map[string]seedUser{}
	for _, u := range practiceRoster() {
		byEmail[u.Email] = u
	}
	for email, role := range wantEmails {
		u, ok := byEmail[email]
		if !ok || u.Role != role {
			t.Fatalf("preferred UAT email %s want role %s got %+v", email, role, u)
		}
	}
}
