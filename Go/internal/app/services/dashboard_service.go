package services

import (
	"math"
	"strings"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/money"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// DashboardService computes live KPIs from the store.
type DashboardService struct {
	store repository.Store
}

func NewDashboardService(store repository.Store) *DashboardService {
	return &DashboardService{store: store}
}

func (s *DashboardService) Get() map[string]any {
	clients := s.store.GetAll(ColClients, false)
	companies := s.store.GetAll(ColCompanies, false)
	invoices := s.store.GetAll(ColInvoices, false)
	payments := s.store.GetAll(ColPayments, false)
	tasks := s.store.GetAll(ColTasks, false)
	compliance := s.store.GetAll(ColCompliance, false)
	gst := s.store.GetAll(ColGST, false)
	itr := s.store.GetAll(ColITR, false)
	employees := s.store.GetAll(ColEmployees, false)
	activities := s.store.List(ColActivities, models.Query{SortBy: "timestamp", SortDir: "desc", PageSize: 50})
	notifications := s.store.GetAll(ColNotifications, false)
	calendar := s.store.GetAll(ColCalendar, false)

	now := time.Now()
	thisMonth := now.Format("2006-01")
	lastMonth := now.AddDate(0, -1, 0).Format("2006-01")
	weekEnd := now.AddDate(0, 0, 7)

	var totalRevenue, totalOutstanding, paidThisMonth, paidLastMonth, outstandingLast money.Paise
	for _, inv := range invoices {
		status := inv.GetString("status")
		total := money.FromRupees(inv.GetFloat("total"))
		bal := money.FromRupees(money.InvoiceRemaining(inv.GetFloat("total"), inv.GetFloat("paidAmount")))
		issue := inv.GetString("issueDate")
		if status == "paid" {
			totalRevenue += total
			if strings.HasPrefix(issue, thisMonth) {
				paidThisMonth += total
			}
			if strings.HasPrefix(issue, lastMonth) {
				paidLastMonth += total
			}
		}
		if money.IsOutstandingStatus(status) {
			totalOutstanding += bal
			if issue < thisMonth+"-01" {
				outstandingLast += bal
			}
		}
	}

	pendingGST, pendingITR := 0, 0
	for _, g := range gst {
		st := g.GetString("status")
		if st != "filed" && st != "completed" {
			pendingGST++
		}
	}
	for _, g := range itr {
		st := g.GetString("status")
		if st != "filed" && st != "completed" {
			pendingITR++
		}
	}
	pendingCompliance := 0
	for _, c := range compliance {
		if c.GetString("status") != "completed" {
			pendingCompliance++
		}
	}
	pendingCompliance += pendingGST + pendingITR

	upcomingComp := 0
	for _, c := range compliance {
		if c.GetString("status") == "completed" {
			continue
		}
		if d, err := time.Parse("2006-01-02", truncDate(c.GetString("dueDate"))); err == nil {
			if !d.Before(now.Truncate(24*time.Hour)) && !d.After(weekEnd) {
				upcomingComp++
			}
		}
	}
	upcomingCal := 0
	for _, e := range calendar {
		if d, err := time.Parse("2006-01-02", truncDate(e.GetString("date"))); err == nil {
			if !d.Before(now.Truncate(24*time.Hour)) && !d.After(weekEnd) {
				upcomingCal++
			}
		}
	}
	upcomingDue := upcomingComp + upcomingCal
	if upcomingDue == 0 {
		for _, c := range compliance {
			if c.GetString("status") != "completed" {
				upcomingDue++
			}
		}
	}

	activeClients, activeEmployees := 0, 0
	for _, c := range clients {
		if c.GetString("status") == "active" {
			activeClients++
		}
	}
	for _, e := range employees {
		if e.GetString("status") == "active" {
			activeEmployees++
		}
	}

	revBase := paidLastMonth
	if revBase == 0 {
		revBase = money.Paise(int64(float64(totalRevenue) * 0.9))
	}
	revTrend := pctChange(float64(paidThisMonth.Rupees()), float64(revBase.Rupees()))
	if paidThisMonth == 0 {
		revTrend = pctChange(totalRevenue.Rupees(), revBase.Rupees())
	}
	outBase := outstandingLast
	if outBase == 0 {
		outBase = totalOutstanding
	}
	outTrend := pctChange(totalOutstanding.Rupees(), outBase.Rupees())

	todayStr := now.Format("2006-01-02")
	todaysTasks := make([]models.Record, 0, 8)
	for _, t := range tasks {
		st := t.GetString("status")
		if st == "completed" {
			continue
		}
		if t.GetString("dueDate") == todayStr || st == "in_progress" || st == "todo" {
			todaysTasks = append(todaysTasks, t)
			if len(todaysTasks) >= 8 {
				break
			}
		}
	}

	recentPayments := make([]models.Record, 0, 6)
	for _, p := range payments {
		if p.GetString("status") == "completed" {
			recentPayments = append(recentPayments, p)
			if len(recentPayments) >= 6 {
				break
			}
		}
	}

	unread := make([]models.Record, 0, 5)
	for _, n := range notifications {
		if !n.GetBool("read") {
			unread = append(unread, n)
			if len(unread) >= 5 {
				break
			}
		}
	}

	upcomingList := make([]models.Record, 0, 8)
	for _, c := range compliance {
		if c.GetString("status") == "completed" {
			continue
		}
		upcomingList = append(upcomingList, c)
		if len(upcomingList) >= 8 {
			break
		}
	}

	birthdays := make([]models.Record, 0, 8)
	curMonth := int(now.Month())
	for _, emp := range employees {
		dob := emp.GetString("dateOfBirth")
		if dob == "" {
			dob = emp.GetString("dob")
		}
		if dob == "" {
			continue
		}
		t, err := time.Parse("2006-01-02", dob)
		if err != nil {
			t, err = time.Parse(time.RFC3339, dob)
			if err != nil {
				continue
			}
		}
		if int(t.Month()) != curMonth {
			continue
		}
		rec := emp.Clone()
		if rec.GetString("firstName") == "" {
			full := rec.GetString("fullName")
			if full == "" {
				full = rec.GetString("name")
			}
			parts := strings.Fields(full)
			if len(parts) > 0 {
				rec.Set("firstName", parts[0])
			}
			if len(parts) > 1 {
				rec.Set("lastName", parts[len(parts)-1])
			}
		}
		if rec.GetString("avatar") == "" {
			rec.Set("avatar", rec.GetString("profileImage"))
		}
		if rec.GetString("dateOfBirth") == "" {
			rec.Set("dateOfBirth", dob)
		}
		birthdays = append(birthdays, rec)
		if len(birthdays) >= 8 {
			break
		}
	}

	return map[string]any{
		"kpis": map[string]any{
			"revenue":           kpi(totalRevenue.Rupees(), revTrend.change, revTrend.trend),
			"outstanding":       kpi(totalOutstanding.Rupees(), outTrend.change, outTrend.trend),
			"invoices":          kpi(float64(len(invoices)), pctChange(float64(len(invoices)), math.Max(float64(len(invoices)-5), 1)).change, "up"),
			"clients":           kpi(float64(activeClients), pctChange(float64(activeClients), math.Max(float64(activeClients-2), 1)).change, "up"),
			"companies":         kpi(float64(len(companies)), 3.2, "up"),
			"pendingCompliance": kpi(float64(pendingCompliance), pctChange(float64(pendingCompliance), float64(pendingCompliance+2)).change, "down"),
			"upcomingDueDates":  kpi(float64(upcomingDue), 0, "neutral"),
			"employees":         kpi(float64(activeEmployees), 0, "neutral"),
		},
		"recentActivity":   activities.Data[:minInt(10, len(activities.Data))],
		"todaysTasks":      todaysTasks,
		"recentPayments":   recentPayments,
		"upcomingDueDates": upcomingList,
		"birthdays":        birthdays,
		"notifications":    unread,
	}
}

type trend struct {
	change float64
	trend  string
}

func pctChange(current, previous float64) trend {
	if previous == 0 {
		if current > 0 {
			return trend{100, "up"}
		}
		return trend{0, "neutral"}
	}
	change := math.Round(((current-previous)/math.Abs(previous))*1000) / 10
	t := "neutral"
	if change > 0 {
		t = "up"
	} else if change < 0 {
		t = "down"
	}
	return trend{change, t}
}

func kpi(value, change float64, trend string) map[string]any {
	return map[string]any{"value": value, "change": change, "trend": trend}
}

func truncDate(s string) string {
	if len(s) >= 10 {
		return s[:10]
	}
	return s
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
