package services

import (
	"math"
	"strings"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/money"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// ReportService computes live report series.
type ReportService struct {
	store repository.Store
}

func NewReportService(store repository.Store) *ReportService {
	return &ReportService{store: store}
}

func (s *ReportService) Summary() map[string]any {
	loaded := parallelGetAll(s.store, false,
		ColInvoices, ColClients, ColCompanies, ColGST, ColITR, ColTasks, ColEmployees,
	)
	invoices := loaded[0]
	clients := loaded[1]
	companies := loaded[2]
	gst := loaded[3]
	itr := loaded[4]
	tasks := loaded[5]
	employees := loaded[6]

	months := last12MonthLabels()
	monthIndex := map[string]int{}
	for i, m := range months {
		monthIndex[m] = i
	}

	revenue := make([]map[string]any, len(months))
	for i, m := range months {
		revenue[i] = map[string]any{"month": m, "revenue": 0.0, "expenses": 0.0, "profit": 0.0}
	}
	for _, inv := range invoices {
		m := monthKey(inv.GetString("issueDate"))
		idx, ok := monthIndex[m]
		if !ok {
			continue
		}
		st := inv.GetString("status")
		if st == "paid" || st == "sent" || st == "overdue" {
			revenue[idx]["revenue"] = revenue[idx]["revenue"].(float64) + inv.GetFloat("total")
		}
	}
	for _, row := range revenue {
		rev := row["revenue"].(float64)
		exp := math.Round(rev * 0.28)
		row["expenses"] = exp
		row["profit"] = rev - exp
	}

	gstFiled := make([]map[string]any, len(months))
	itrFiled := make([]map[string]any, len(months))
	for i, m := range months {
		gstFiled[i] = map[string]any{"month": m, "filed": 0, "pending": 0, "overdue": 0}
		itrFiled[i] = map[string]any{"month": m, "filed": 0, "pending": 0}
	}
	for _, g := range gst {
		m := monthKey(firstNonEmpty(g.GetString("dueDate"), g.GetString("filedDate")))
		idx, ok := monthIndex[m]
		if !ok {
			continue
		}
		st := g.GetString("status")
		switch {
		case st == "filed" || st == "completed":
			gstFiled[idx]["filed"] = gstFiled[idx]["filed"].(int) + 1
		case st == "overdue":
			gstFiled[idx]["overdue"] = gstFiled[idx]["overdue"].(int) + 1
		default:
			gstFiled[idx]["pending"] = gstFiled[idx]["pending"].(int) + 1
		}
	}
	for _, g := range itr {
		m := monthKey(firstNonEmpty(g.GetString("dueDate"), g.GetString("filedDate")))
		idx, ok := monthIndex[m]
		if !ok {
			continue
		}
		st := g.GetString("status")
		if st == "filed" || st == "completed" {
			itrFiled[idx]["filed"] = itrFiled[idx]["filed"].(int) + 1
		} else {
			itrFiled[idx]["pending"] = itrFiled[idx]["pending"].(int) + 1
		}
	}

	clientGrowth := make([]map[string]any, len(months))
	now := time.Now()
	for i, m := range months {
		cutoff := now.AddDate(0, -(11 - i), 0)
		cutoff = time.Date(cutoff.Year(), cutoff.Month()+1, 0, 23, 59, 59, 0, cutoff.Location())
		cCount, coCount := 0, 0
		for _, c := range clients {
			if ca := c.GetString("createdAt"); ca == "" || !parseTime(ca).After(cutoff) {
				cCount++
			}
		}
		for _, c := range companies {
			if ca := c.GetString("createdAt"); ca == "" || !parseTime(ca).After(cutoff) {
				coCount++
			}
		}
		clientGrowth[i] = map[string]any{"month": m, "clients": cCount, "companies": coCount}
	}

	outstandingTrend := make([]map[string]any, len(months))
	for i, m := range months {
		var amount money.Paise
		for _, inv := range invoices {
			mk := monthKey(inv.GetString("issueDate"))
			invIdx, ok := monthIndex[mk]
			if !ok || invIdx > i {
				continue
			}
			if money.IsOutstandingStatus(inv.GetString("status")) {
				amount += money.FromRupees(money.InvoiceRemaining(inv.GetFloat("total"), inv.GetFloat("paidAmount")))
			}
		}
		outstandingTrend[i] = map[string]any{"month": m, "amount": amount.Rupees()}
	}

	taskCompletion := make([]map[string]any, len(months))
	for i, m := range months {
		completed, pending := 0, 0
		for _, t := range tasks {
			mk := monthKey(firstNonEmpty(t.GetString("completedAt"), t.GetString("dueDate"), t.GetString("createdAt")))
			if mk != m {
				continue
			}
			if t.GetString("status") == "completed" {
				completed++
			} else {
				pending++
			}
		}
		taskCompletion[i] = map[string]any{"month": m, "completed": completed, "pending": pending}
	}

	serviceMap := map[string]struct {
		count   int
		revenue float64
	}{}
	for _, c := range clients {
		services := stringSlice(c["services"])
		if len(services) == 0 {
			services = []string{"General"}
		}
		share := c.GetFloat("revenue") / float64(len(services))
		for _, svc := range services {
			cur := serviceMap[svc]
			cur.count++
			cur.revenue += share
			serviceMap[svc] = cur
		}
	}
	serviceBreakdown := make([]map[string]any, 0, len(serviceMap))
	for svc, v := range serviceMap {
		serviceBreakdown = append(serviceBreakdown, map[string]any{
			"service": svc, "count": v.count, "revenue": math.Round(v.revenue),
		})
	}

	employeePerformance := make([]map[string]any, 0)
	for _, e := range employees {
		if e.GetString("status") != "active" {
			continue
		}
		name := strings.TrimSpace(e.GetString("firstName") + " " + e.GetString("lastName"))
		tasksDone, clientsManaged := 0, 0
		var rev money.Paise
		for _, t := range tasks {
			if t.GetString("assignedTo") == e.ID() && t.GetString("status") == "completed" {
				tasksDone++
			}
		}
		clientAssign := map[string]bool{}
		for _, c := range clients {
			if c.GetString("assignedTo") == e.ID() {
				clientsManaged++
				clientAssign[c.ID()] = true
			}
		}
		for _, inv := range invoices {
			if inv.GetString("status") == "paid" && clientAssign[inv.GetString("clientId")] {
				rev += money.FromRupees(inv.GetFloat("total"))
			}
		}
		employeePerformance = append(employeePerformance, map[string]any{
			"name": name, "tasksCompleted": tasksDone, "clientsManaged": clientsManaged, "revenue": rev.Rupees(),
		})
	}

	return map[string]any{
		"revenue":             revenue,
		"gstFiled":            gstFiled,
		"itrFiled":            itrFiled,
		"clientGrowth":        clientGrowth,
		"outstandingTrend":    outstandingTrend,
		"taskCompletion":      taskCompletion,
		"serviceBreakdown":    serviceBreakdown,
		"employeePerformance": employeePerformance,
	}
}

func last12MonthLabels() []string {
	out := make([]string, 12)
	now := time.Now()
	for i := 11; i >= 0; i-- {
		out[11-i] = now.AddDate(0, -i, 0).Format("Jan")
	}
	return out
}

func monthKey(date string) string {
	if date == "" {
		return ""
	}
	t := parseTime(date)
	if t.IsZero() {
		return ""
	}
	return t.Format("Jan")
}

func parseTime(s string) time.Time {
	s = strings.TrimSpace(s)
	for _, layout := range []string{time.RFC3339, "2006-01-02", "2006-01-02T15:04:05Z"} {
		if t, err := time.Parse(layout, truncDate(s)); err == nil {
			return t
		}
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func stringSlice(v any) []string {
	switch t := v.(type) {
	case []string:
		return t
	case []any:
		out := make([]string, 0, len(t))
		for _, x := range t {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}
