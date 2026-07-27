package main

// Practice UAT roster — ~55 named users for Alok firm (Architecture D5 / ROLE_HIERARCHY).
// IDs use PRACTICE- prefix; emails use @practice.smartca.in for idempotent wipe.

type seedUser struct {
	ID, Email, FullName, Role, Dept, Designation, ReportsTo string
}

func practiceRoster() []seedUser {
	// Leadership
	const (
		ptrRajesh = "PRACTICE-PTR-RAJESH"
		ptrMeena  = "PRACTICE-PTR-MEENA"
		ptrSuresh = "PRACTICE-PTR-SURESH"
		mgrAlok   = "PRACTICE-MGR-ALOK"
		caNitesh  = "PRACTICE-CA-NITESH"
		caVamsi   = "PRACTICE-CA-VAMSI"
		caAnudeep = "PRACTICE-CA-ANUDEEP"
		caKavita  = "PRACTICE-CA-KAVITA"
		caRohan   = "PRACTICE-CA-ROHAN"
		caPriya   = "PRACTICE-CA-PRIYA"
		tlMukesh  = "PRACTICE-TL-MUKESH"
		tlAmit    = "PRACTICE-TL-AMIT"
		tlSneha   = "PRACTICE-TL-SNEHA"
		tlRavi    = "PRACTICE-TL-RAVI"
		tlAnjali  = "PRACTICE-TL-ANJALI"
		tlManish  = "PRACTICE-TL-MANISH"
	)

	u := func(id, email, full, role, dept, desig, reportsTo string) seedUser {
		return seedUser{ID: id, Email: email, FullName: full, Role: role, Dept: dept, Designation: desig, ReportsTo: reportsTo}
	}

	return []seedUser{
		// Partners (3)
		u(ptrRajesh, "rajesh@practice.smartca.in", "Rajesh Kulkarni", "partner", "Leadership", "Equity Partner", ""),
		u(ptrMeena, "meena@practice.smartca.in", "Meena Deshmukh", "partner", "Leadership", "Equity Partner", ""),
		u(ptrSuresh, "suresh@practice.smartca.in", "Suresh Patil", "partner", "Leadership", "Equity Partner", ""),
		// Manager ops head (1)
		u(mgrAlok, "alok@practice.smartca.in", "Alok Joshi", "manager", "Leadership", "Practice Manager", ptrRajesh),
		// Client Owner CAs (6)
		u(caNitesh, "nitesh@practice.smartca.in", "Nitesh Sharma", "ca", "Assurance", "Client Owner CA", mgrAlok),
		u(caVamsi, "vamsi@practice.smartca.in", "Vamsi Reddy", "ca", "GST", "Client Owner CA", mgrAlok),
		u(caAnudeep, "anudeep@practice.smartca.in", "Anudeep Rao", "ca", "ITR", "Client Owner CA", mgrAlok),
		u(caKavita, "kavita@practice.smartca.in", "Kavita Iyer", "ca", "ROC", "Client Owner CA", mgrAlok),
		u(caRohan, "rohan@practice.smartca.in", "Rohan Mehta", "ca", "Audit", "Client Owner CA", mgrAlok),
		u(caPriya, "priya@practice.smartca.in", "Priya Nair", "ca", "TDS", "Client Owner CA", mgrAlok),
		// Senior CAs (4)
		u("PRACTICE-SCA-VIKRAM", "vikram@practice.smartca.in", "Vikram Singh", "senior_ca", "Assurance", "Senior CA", caNitesh),
		u("PRACTICE-SCA-NEHA", "neha@practice.smartca.in", "Neha Kulkarni", "senior_ca", "GST", "Senior CA", caVamsi),
		u("PRACTICE-SCA-ARJUN", "arjun@practice.smartca.in", "Arjun Desai", "senior_ca", "ITR", "Senior CA", caAnudeep),
		u("PRACTICE-SCA-POOJA", "pooja@practice.smartca.in", "Pooja Banerjee", "senior_ca", "ROC", "Senior CA", caKavita),
		// Team Leaders (6)
		u(tlMukesh, "mukesh@practice.smartca.in", "Mukesh Verma", "team_leader", "Assurance", "Team Leader", caNitesh),
		u(tlAmit, "amit@practice.smartca.in", "Amit Joshi", "team_leader", "GST", "Team Leader", caVamsi),
		u(tlSneha, "sneha@practice.smartca.in", "Sneha Patil", "team_leader", "ITR", "Team Leader", caAnudeep),
		u(tlRavi, "ravi@practice.smartca.in", "Ravi Kumar", "team_leader", "ROC", "Team Leader", caKavita),
		u(tlAnjali, "anjali@practice.smartca.in", "Anjali Gupta", "team_leader", "Audit", "Team Leader", caRohan),
		u(tlManish, "manish@practice.smartca.in", "Manish Tiwari", "team_leader", "TDS", "Team Leader", caPriya),
		// Junior CAs (8)
		u("PRACTICE-JCA-01", "aditya@practice.smartca.in", "Aditya More", "junior_ca", "Assurance", "Junior CA", tlMukesh),
		u("PRACTICE-JCA-02", "ishita@practice.smartca.in", "Ishita Shah", "junior_ca", "GST", "Junior CA", tlAmit),
		u("PRACTICE-JCA-03", "yash@practice.smartca.in", "Yash Pawar", "junior_ca", "ITR", "Junior CA", tlSneha),
		u("PRACTICE-JCA-04", "riya@practice.smartca.in", "Riya Kulkarni", "junior_ca", "ROC", "Junior CA", tlRavi),
		u("PRACTICE-JCA-05", "harsh@practice.smartca.in", "Harsh Bhosale", "junior_ca", "Audit", "Junior CA", tlAnjali),
		u("PRACTICE-JCA-06", "tanvi@practice.smartca.in", "Tanvi Deshpande", "junior_ca", "TDS", "Junior CA", tlManish),
		u("PRACTICE-JCA-07", "omkar@practice.smartca.in", "Omkar Jadhav", "junior_ca", "Assurance", "Junior CA", tlMukesh),
		u("PRACTICE-JCA-08", "sakshi@practice.smartca.in", "Sakshi Ghule", "junior_ca", "GST", "Junior CA", tlAmit),
		// Article assistants (10)
		u("PRACTICE-ART-01", "kunal@practice.smartca.in", "Kunal Shinde", "article_assistant", "Assurance", "Article Assistant", tlMukesh),
		u("PRACTICE-ART-02", "aishwarya@practice.smartca.in", "Aishwarya Rane", "article_assistant", "GST", "Article Assistant", tlAmit),
		u("PRACTICE-ART-03", "pranav@practice.smartca.in", "Pranav Kadam", "article_assistant", "ITR", "Article Assistant", tlSneha),
		u("PRACTICE-ART-04", "mitali@practice.smartca.in", "Mitali Joshi", "article_assistant", "ROC", "Article Assistant", tlRavi),
		u("PRACTICE-ART-05", "siddharth@practice.smartca.in", "Siddharth Naik", "article_assistant", "Audit", "Article Assistant", tlAnjali),
		u("PRACTICE-ART-06", "pooja.art@practice.smartca.in", "Pooja Salvi", "article_assistant", "TDS", "Article Assistant", tlManish),
		u("PRACTICE-ART-07", "rohit@practice.smartca.in", "Rohit Chavan", "article_assistant", "Assurance", "Article Assistant", tlMukesh),
		u("PRACTICE-ART-08", "nikita@practice.smartca.in", "Nikita Barge", "article_assistant", "GST", "Article Assistant", tlAmit),
		u("PRACTICE-ART-09", "varun@practice.smartca.in", "Varun Gokhale", "article_assistant", "ITR", "Article Assistant", tlSneha),
		u("PRACTICE-ART-10", "snehal@practice.smartca.in", "Snehal Phadke", "article_assistant", "ROC", "Article Assistant", tlRavi),
		// Accountants (8)
		u("PRACTICE-ACC-01", "ganesh@practice.smartca.in", "Ganesh Lokhande", "accountant", "GST", "Accountant", tlAmit),
		u("PRACTICE-ACC-02", "sunita@practice.smartca.in", "Sunita Waghmare", "accountant", "ITR", "Accountant", tlSneha),
		u("PRACTICE-ACC-03", "mahesh@practice.smartca.in", "Mahesh Kale", "accountant", "TDS", "Accountant", tlManish),
		u("PRACTICE-ACC-04", "lata@practice.smartca.in", "Lata Bhonsle", "accountant", "Assurance", "Accountant", tlMukesh),
		u("PRACTICE-ACC-05", "nilesh@practice.smartca.in", "Nilesh Sawant", "accountant", "GST", "Accountant", tlAmit),
		u("PRACTICE-ACC-06", "rekha@practice.smartca.in", "Rekha More", "accountant", "ITR", "Accountant", tlSneha),
		u("PRACTICE-ACC-07", "suresh.acc@practice.smartca.in", "Suresh Dhumal", "accountant", "ROC", "Accountant", tlRavi),
		u("PRACTICE-ACC-08", "jyoti@practice.smartca.in", "Jyoti Pawar", "accountant", "Audit", "Accountant", tlAnjali),
		// General employees (4)
		u("PRACTICE-EMP-01", "amol@practice.smartca.in", "Amol Kharat", "employee", "Operations", "Executive", tlMukesh),
		u("PRACTICE-EMP-02", "deepa@practice.smartca.in", "Deepa Shetty", "employee", "Operations", "Executive", tlAmit),
		u("PRACTICE-EMP-03", "prasad@practice.smartca.in", "Prasad Ingale", "employee", "Operations", "Executive", tlSneha),
		u("PRACTICE-EMP-04", "kavya@practice.smartca.in", "Kavya Menon", "employee", "Operations", "Executive", tlRavi),
		// HR (2) — no client work; PENDING_PLACEMENT support
		u("PRACTICE-HR-SHRUTI", "shruti@practice.smartca.in", "Shruti Pawar", "hr", "People", "HR Manager", mgrAlok),
		u("PRACTICE-HR-ANITA", "anita@practice.smartca.in", "Anita Desai", "hr", "People", "HR Executive", "PRACTICE-HR-SHRUTI"),
		// Reception (2)
		u("PRACTICE-RCP-01", "fatima@practice.smartca.in", "Fatima Sheikh", "reception", "Front Office", "Receptionist", mgrAlok),
		u("PRACTICE-RCP-02", "leena@practice.smartca.in", "Leena Thomas", "reception", "Front Office", "Receptionist", mgrAlok),
		// Admin (1)
		u("PRACTICE-ADM-01", "admin.practice@practice.smartca.in", "Vivek Apte", "admin", "IT", "System Admin", mgrAlok),
	}
}

func rosterByRole(role string) []seedUser {
	var out []seedUser
	for _, u := range practiceRoster() {
		if u.Role == role {
			out = append(out, u)
		}
	}
	return out
}

func findUser(id string) seedUser {
	for _, u := range practiceRoster() {
		if u.ID == id {
			return u
		}
	}
	return seedUser{}
}
