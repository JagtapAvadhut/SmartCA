package ai_test

import (
	"context"
	"strings"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

func TestPromptTemplates(t *testing.T) {
	for _, id := range []string{
		ai.TplChat, ai.TplSummarize, ai.TplEmail, ai.TplClientSummary,
		ai.TplDocumentAnalysis, ai.TplDashboardInsights, ai.TplGSTExplain,
	} {
		p := ai.BuildSystemPrompt(id)
		if !strings.Contains(p, "SmartCA AI") && !strings.Contains(p, "Smart CA AI") {
			t.Fatalf("template %s missing base identity", id)
		}
	}
}

func TestLimitHistory(t *testing.T) {
	var msgs []ai.Message
	for i := 0; i < 20; i++ {
		msgs = append(msgs, ai.Message{Role: "user", Content: "x"})
	}
	got := ai.LimitHistory(msgs, 8)
	if len(got) != 8 {
		t.Fatalf("want 8 got %d", len(got))
	}
}

func TestChatValidation(t *testing.T) {
	p, err := ai.NewProviderFromConfig(config.Config{AIProvider: "mock"})
	if err != nil {
		t.Fatal(err)
	}
	svc := ai.NewService(config.Config{GeminiMaxTokens: 512}, repository.AdaptMemory(memory.NewStore()), nil, p)
	_, err = svc.Chat(context.Background(), "t1", ai.ChatInput{Message: "   "})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestMockChat(t *testing.T) {
	p, _ := ai.NewProviderFromConfig(config.Config{AIProvider: "mock"})
	svc := ai.NewService(config.Config{}, repository.AdaptMemory(memory.NewStore()), nil, p)
	out, err := svc.Chat(context.Background(), "t2", ai.ChatInput{Message: "Explain GST"})
	if err != nil {
		t.Fatal(err)
	}
	if out.Reply == "" || out.Provider != "mock" {
		t.Fatalf("unexpected: %+v", out)
	}
}

func TestCompactUserPrompt(t *testing.T) {
	s := ai.CompactUserPrompt("Do X", `{"a":1}`, "hello")
	if !strings.Contains(s, "CONTEXT:") || !strings.Contains(s, "REQUEST:") {
		t.Fatal(s)
	}
}
