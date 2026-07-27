package main

import "fmt"

// receptionRoster returns WM front-office users for intake UAT (BUG-0011).
// Role is canonical hierarchy "reception" (NormalizeHierarchyRole also accepts "receptionist").
func receptionRoster(reportsToManager string) []struct {
	ID, Email, FullName, Role, Department, ReportsTo string
} {
	out := make([]struct {
		ID, Email, FullName, Role, Department, ReportsTo string
	}, 0, nReception)
	for i := 1; i <= nReception; i++ {
		out = append(out, struct {
			ID, Email, FullName, Role, Department, ReportsTo string
		}{
			ID:         fmt.Sprintf("WM-RCP-%04d", i),
			Email:      fmt.Sprintf("reception%d@wm.smartca.in", i),
			FullName:   fmt.Sprintf("Receptionist %d", i),
			Role:       "reception",
			Department: "Front Office",
			ReportsTo:  reportsToManager,
		})
	}
	return out
}
