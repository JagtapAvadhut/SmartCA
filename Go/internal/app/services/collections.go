package services

// Collection names mirrored from the frontend MockDatabase.
const (
	ColClients       = "clients"
	ColCompanies     = "companies"
	ColEmployees     = "employees"
	ColInvoices      = "invoices"
	ColPayments      = "payments"
	ColDocuments     = "documents"
	ColTasks         = "tasks"
	ColGST           = "gst"
	ColITR           = "itr"
	ColTDS           = "tds"
	ColROC           = "roc"
	ColCompliance    = "compliance"
	ColNotifications = "notifications"
	ColActivities    = "activities"
	ColCalendar      = "calendar"
	ColUsers         = "users"
	ColRoles         = "roles"
	ColPermissions   = "permissions"
	ColOrganization  = "organization"
	ColSettings      = "settings"
	ColAuditLogs     = "auditLogs"
	ColLoginHistory  = "loginHistory"
	ColChat          = "chat"
	ColDepartments   = "departments"
	ColBranches      = "branches"
	ColNotes         = "notes"
	ColJournals      = "journals"
	ColSessions      = "sessions"
)

// CollectionNames is a list of all collection names
var CollectionNames = []string{
	ColClients, ColCompanies, ColEmployees, ColInvoices, ColPayments,
	ColDocuments, ColTasks, ColGST, ColITR, ColTDS, ColROC, ColCompliance,
	ColNotifications, ColActivities, ColCalendar, ColUsers, ColRoles,
	ColPermissions, ColOrganization, ColSettings, ColAuditLogs,
	ColLoginHistory, ColChat, ColDepartments, ColBranches, ColNotes,
	ColJournals, ColSessions,
}

// SearchFields returns default search fields per collection.
func SearchFields(collection string) []string {
	switch collection {
	case ColClients:
		return []string{"name", "email", "phone", "gstin", "pan", "city", "type"}
	case ColCompanies:
		return []string{"name", "cin", "gstin", "email", "city"}
	case ColEmployees:
		return []string{"firstName", "lastName", "fullName", "email", "designation", "department"}
	case ColInvoices:
		return []string{"invoiceNumber", "clientName", "status"}
	case ColPayments:
		return []string{"reference", "clientName", "invoiceNumber", "method"}
	case ColDocuments:
		return []string{"name", "fileName", "category", "clientName"}
	case ColTasks:
		return []string{"title", "description", "status", "priority"}
	case ColCompliance:
		return []string{"title", "type", "clientName", "status"}
	case ColGST:
		return []string{"clientName", "returnType", "period", "status"}
	case ColITR:
		return []string{"clientName", "assessmentYear", "filingType", "status"}
	case ColTDS:
		return []string{"clientName", "formType", "quarter", "status"}
	case ColROC:
		return []string{"companyName", "formType", "cin", "status"}
	case ColNotes:
		return []string{"title", "content", "entityType"}
	case ColNotifications:
		return []string{"title", "message", "type"}
	case ColCalendar:
		return []string{"title", "description", "type"}
	case ColActivities:
		return []string{"message", "type", "clientName", "userName"}
	case ColAuditLogs:
		return []string{"action", "entity", "userName", "details"}
	case ColUsers:
		return []string{"fullName", "email", "username", "loginId", "role"}
	case ColRoles:
		return []string{"name"}
	case ColPermissions:
		return []string{"name", "key", "module"}
	default:
		return nil
	}
}
