package main

// ABC Professional Services LLP — 50 users for purchase UAT.
// IDs: ABC-*; emails: @abc.smartca.in
// Hierarchy: Emp → TL → CA → Practice Manager → Managing Partner
// Partners sit under Managing Partner for sign-off (not in delivery chain).
//
// Headcount note: requested 1+2+1+1+5+8+35 = 53 plus reception.
// Trimmed employees 35→31 so firm stays at exactly 50 including reception.

import "fmt"

type seedUser struct {
	ID, Email, FullName, Role, Dept, Designation, ReportsTo string
}

const (
	idMP  = "ABC-MP-01"
	idP1  = "ABC-PTR-01"
	idP2  = "ABC-PTR-02"
	idPM  = "ABC-MGR-01"
	idHR  = "ABC-HR-01"
	idRCP = "ABC-RCP-01"
	idCA1 = "ABC-CA-01"
	idCA2 = "ABC-CA-02"
	idCA3 = "ABC-CA-03"
	idCA4 = "ABC-CA-04"
	idCA5 = "ABC-CA-05"
	idTL1 = "ABC-TL-01"
	idTL2 = "ABC-TL-02"
	idTL3 = "ABC-TL-03"
	idTL4 = "ABC-TL-04"
	idTL5 = "ABC-TL-05"
	idTL6 = "ABC-TL-06"
	idTL7 = "ABC-TL-07"
	idTL8 = "ABC-TL-08"
)

func abcRoster() []seedUser {
	u := func(id, email, full, role, dept, desig, reportsTo string) seedUser {
		return seedUser{ID: id, Email: email, FullName: full, Role: role, Dept: dept, Designation: desig, ReportsTo: reportsTo}
	}

	out := []seedUser{
		u(idMP, "managing.partner@abc.smartca.in", "Vikram Malhotra", "partner", "Leadership", "Managing Partner", ""),
		u(idP1, "partner1@abc.smartca.in", "Ananya Krishnan", "partner", "Leadership", "Equity Partner", idMP),
		u(idP2, "partner2@abc.smartca.in", "Sanjay Agarwal", "partner", "Leadership", "Equity Partner", idMP),
		u(idPM, "practice.manager@abc.smartca.in", "Neha Banerjee", "manager", "Operations", "Practice Manager", idMP),
		u(idHR, "hr@abc.smartca.in", "Priya Chauhan", "hr", "People", "HR Manager", idPM),
		u(idRCP, "reception@abc.smartca.in", "Fatima Qureshi", "reception", "Front Office", "Receptionist", idPM),
		u(idCA1, "ca1@abc.smartca.in", "Rohan Deshmukh", "ca", "GST", "Chartered Accountant", idPM),
		u(idCA2, "ca2@abc.smartca.in", "Meera Iyer", "ca", "ITR", "Chartered Accountant", idPM),
		u(idCA3, "ca3@abc.smartca.in", "Arjun Kapoor", "ca", "Audit", "Chartered Accountant", idPM),
		u(idCA4, "ca4@abc.smartca.in", "Kavita Nair", "ca", "ROC", "Chartered Accountant", idPM),
		u(idCA5, "ca5@abc.smartca.in", "Aditya Joshi", "ca", "TDS", "Chartered Accountant", idPM),
		u(idTL1, "tl1@abc.smartca.in", "Amit Sharma", "team_leader", "GST", "Team Leader", idCA1),
		u(idTL2, "tl2@abc.smartca.in", "Sneha Patil", "team_leader", "GST", "Team Leader", idCA1),
		u(idTL3, "tl3@abc.smartca.in", "Ravi Kumar", "team_leader", "ITR", "Team Leader", idCA2),
		u(idTL4, "tl4@abc.smartca.in", "Anjali Gupta", "team_leader", "ITR", "Team Leader", idCA2),
		u(idTL5, "tl5@abc.smartca.in", "Manish Tiwari", "team_leader", "Audit", "Team Leader", idCA3),
		u(idTL6, "tl6@abc.smartca.in", "Pooja Reddy", "team_leader", "Audit", "Team Leader", idCA3),
		u(idTL7, "tl7@abc.smartca.in", "Nikhil Bhosale", "team_leader", "ROC", "Team Leader", idCA4),
		u(idTL8, "tl8@abc.smartca.in", "Divya Menon", "team_leader", "TDS", "Team Leader", idCA5),
	}

	first := []string{
		"Rahul", "Priyanka", "Suresh", "Deepika", "Vishal", "Ankita", "Gaurav", "Shweta",
		"Nitin", "Komal", "Sachin", "Rutuja", "Harsh", "Tanvi", "Omkar", "Sakshi",
		"Pranav", "Mitali", "Yash", "Riya", "Kunal", "Aishwarya", "Varun", "Snehal",
		"Mahesh", "Lata", "Nilesh", "Rekha", "Amol", "Deepa", "Prasad",
	}
	last := []string{
		"Joshi", "Kulkarni", "Patil", "Desai", "More", "Shah", "Pawar", "Naik",
		"Chavan", "Barge", "Gokhale", "Phadke", "Waghmare", "Kale", "Sawant", "Bhonsle",
		"Lokhande", "Dhumal", "Kharat", "Shetty", "Ingale", "Menon", "Salvi", "Rane",
		"Kadam", "Ghule", "Bhosale", "Deshpande", "Jadhav", "Banerjee", "Singh",
	}
	tls := []string{idTL1, idTL2, idTL3, idTL4, idTL5, idTL6, idTL7, idTL8}
	depts := []string{"GST", "GST", "ITR", "ITR", "Audit", "Audit", "ROC", "TDS"}
	for i := 0; i < 31; i++ {
		tl := tls[i%len(tls)]
		out = append(out, u(
			fmt.Sprintf("ABC-EMP-%02d", i+1),
			fmt.Sprintf("emp%d@abc.smartca.in", i+1),
			first[i]+" "+last[i],
			"employee",
			depts[i%len(depts)],
			"Executive",
			tl,
		))
	}
	return out
}

func rosterByRole(role string) []seedUser {
	var out []seedUser
	for _, u := range abcRoster() {
		if u.Role == role {
			out = append(out, u)
		}
	}
	return out
}

func findUser(id string) seedUser {
	for _, u := range abcRoster() {
		if u.ID == id {
			return u
		}
	}
	return seedUser{}
}

func caForTL(tlID string) seedUser {
	tl := findUser(tlID)
	return findUser(tl.ReportsTo)
}
