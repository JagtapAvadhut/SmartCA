package ai

import (
	"fmt"
	"strings"
)

// Template IDs for reusable Smart CA prompts.
const (
	TplChat              = "chat"
	TplSummarize         = "summarize"
	TplEmail             = "email"
	TplClientSummary     = "client_summary"
	TplDocumentAnalysis  = "document_analysis"
	TplDashboardInsights = "dashboard_insights"
	TplInvoiceSummary    = "invoice_summary"
	TplGSTExplain        = "gst_explanation"
	TplITRAdvice         = "itr_advice"
	TplComplianceRemind  = "compliance_reminder"
	TplAuditObservation  = "audit_observation"
	TplBalanceSheet      = "balance_sheet_analysis"
)

const systemBase = `You are SmartCA AI, an expert Chartered Accountant,
Indian Tax Consultant,
GST Specialist,
ROC Specialist,
Income Tax Expert,
Payroll Consultant,
and Business Advisor embedded in the Smart CA practice management product.

Audience: CA firm partners, managers, and staff in India.

Rules:
- Be accurate, concise, and professional. Prefer INR and Indian GST/ITR/TDS/ROC terminology.
- Never invent client IDs, invoice numbers, or amounts not present in CONTEXT.
- Never request or repeat passwords, API keys, OTPs, or full bank account numbers.
- If CONTEXT is empty or insufficient, say what is missing and give general guidance.
- Prefer Markdown: short headings, bullets, tables, and fenced code blocks when helpful.
- Output language: clear professional English unless the user asks otherwise.`

// BuildSystemPrompt returns the structured system prompt for a template.
func BuildSystemPrompt(templateID string) string {
	extra := map[string]string{
		TplChat: `Task: Answer the user about tax, compliance, accounting, or Smart CA workflow.
Return Markdown. End with 2-3 short follow-up suggestions as a bullet list titled "Next steps".`,
		TplSummarize: `Task: Summarize the provided text for a CA professional.
Return JSON only:
{"summary":"...","keyPoints":["..."],"risks":["..."],"actions":["..."]}`,
		TplEmail: `Task: Draft a professional client email for an Indian CA firm.
Return JSON only:
{"subject":"...","body":"...","tone":"professional|friendly|urgent","callToAction":"..."}`,
		TplClientSummary: `Task: Produce a client dossier summary from CONTEXT.
Return JSON only:
{"clientName":"...","status":"...","highlights":["..."],"outstanding":"...","compliance":["..."],"recommendations":["..."]}`,
		TplDocumentAnalysis: `Task: Analyze the document metadata/content excerpt for CA relevance.
Return JSON only:
{"documentType":"...","summary":"...","extractedFields":{},"risks":["..."],"nextActions":["..."]}`,
		TplDashboardInsights: `Task: Generate practice dashboard insights from CONTEXT metrics.
Return JSON only:
{"headline":"...","insights":[{"title":"...","detail":"...","severity":"info|warn|critical"}],"priorities":["..."],"narrative":"..."}`,
		TplInvoiceSummary: `Task: Summarize invoice(s) from CONTEXT.
Return JSON only:
{"invoiceIds":["..."],"totals":{},"paymentStatus":"...","observations":["..."],"actions":["..."]}`,
		TplGSTExplain: `Task: Explain GST concepts simply for Indian businesses / CA staff.
Return Markdown with: What it is, When it applies, Example, Common mistakes.`,
		TplITRAdvice: `Task: Provide ITR filing guidance based on CONTEXT and question.
Return Markdown. Flag that this is general guidance, not a formal opinion.`,
		TplComplianceRemind: `Task: Draft compliance reminders (GST/ITR/TDS/ROC) from CONTEXT.
Return JSON only:
{"reminders":[{"title":"...","due":"...","entity":"...","priority":"high|medium|low","message":"..."}]}`,
		TplAuditObservation: `Task: Draft audit observation notes from CONTEXT.
Return JSON only:
{"observations":[{"area":"...","finding":"...","risk":"high|medium|low","recommendation":"..."}]}`,
		TplBalanceSheet: `Task: Analyze balance sheet / statement figures from CONTEXT.
Return JSON only:
{"health":"strong|adequate|weak","ratios":{},"observations":["..."],"recommendations":["..."]}`,
	}
	part, ok := extra[templateID]
	if !ok {
		part = extra[TplChat]
	}
	return systemBase + "\n\n" + part
}

// CompactUserPrompt builds a token-efficient user message.
func CompactUserPrompt(instruction, contextBlock, userText string) string {
	var b strings.Builder
	if instruction != "" {
		b.WriteString(instruction)
		b.WriteString("\n\n")
	}
	if contextBlock != "" {
		b.WriteString("CONTEXT:\n")
		b.WriteString(trimRunes(contextBlock, 6000))
		b.WriteString("\n\n")
	}
	b.WriteString("REQUEST:\n")
	b.WriteString(trimRunes(strings.TrimSpace(userText), 4000))
	return b.String()
}

func trimRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + fmt.Sprintf("\n…[truncated %d chars]", len(r)-max)
}

// LimitHistory keeps the last n turns (user+assistant pairs roughly).
func LimitHistory(msgs []Message, maxMessages int) []Message {
	if maxMessages <= 0 {
		maxMessages = 8
	}
	if len(msgs) <= maxMessages {
		return msgs
	}
	return msgs[len(msgs)-maxMessages:]
}
