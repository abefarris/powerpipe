package controlexecute

import (
	"sync"
	"testing"

	"github.com/turbot/powerpipe/internal/controlstatus"
)

func TestParseTargetPassRate(t *testing.T) {
	tests := map[string]struct {
		input    string
		expected float64
		ok       bool
	}{
		"plain integer":        {input: "95", expected: 95, ok: true},
		"decimal":              {input: "99.5", expected: 99.5, ok: true},
		"percent suffix":       {input: "95%", expected: 95, ok: true},
		"surrounding spaces":   {input: "  95  ", expected: 95, ok: true},
		"spaces around percent": {input: " 95 % ", expected: 95, ok: true},
		"zero":                 {input: "0", expected: 0, ok: true},
		"hundred":              {input: "100", expected: 100, ok: true},
		"empty":                {input: "", expected: 0, ok: false},
		"whitespace only":      {input: "   ", expected: 0, ok: false},
		"not a number":         {input: "abc", expected: 0, ok: false},
		"negative":             {input: "-5", expected: 0, ok: false},
		"over one hundred":     {input: "150", expected: 0, ok: false},
		"number with garbage":  {input: "95x", expected: 0, ok: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			target, ok := parseTargetPassRate(tt.input)
			if ok != tt.ok {
				t.Fatalf("parseTargetPassRate(%q) ok = %v, expected %v", tt.input, ok, tt.ok)
			}
			if ok && target != tt.expected {
				t.Fatalf("parseTargetPassRate(%q) = %v, expected %v", tt.input, target, tt.expected)
			}
		})
	}
}

// makeScoreGroup builds a minimal ResultGroup carrying a status summary, for
// exercising populateScores without an execution tree.
func makeScoreGroup(groupId string, tags map[string]string, status controlstatus.StatusSummary) *ResultGroup {
	if tags == nil {
		tags = map[string]string{}
	}
	g := &ResultGroup{
		GroupId:    groupId,
		Tags:       tags,
		Summary:    NewGroupSummary(),
		updateLock: new(sync.Mutex),
	}
	g.Summary.Status = status
	return g
}

func TestPopulateScores(t *testing.T) {
	tests := map[string]struct {
		tags           map[string]string
		status         controlstatus.StatusSummary
		expectRate     *float64
		expectTarget   *float64
		expectMet      *bool
	}{
		"rate only, no tag": {
			status:     controlstatus.StatusSummary{Ok: 3, Alarm: 1},
			expectRate: f(75),
		},
		"skips excluded from the denominator": {
			status:     controlstatus.StatusSummary{Ok: 3, Alarm: 1, Skip: 6},
			expectRate: f(75),
		},
		"errors count as failures": {
			status:     controlstatus.StatusSummary{Ok: 2, Error: 2},
			expectRate: f(50),
		},
		"info counts as passing": {
			status:     controlstatus.StatusSummary{Info: 4, Alarm: 1},
			expectRate: f(80),
		},
		"nothing evaluated has no rate": {
			status: controlstatus.StatusSummary{Skip: 5},
		},
		"target met": {
			tags:         map[string]string{TargetPassRateTagKey: "60"},
			status:       controlstatus.StatusSummary{Ok: 3, Alarm: 1},
			expectRate:   f(75),
			expectTarget: f(60),
			expectMet:    b(true),
		},
		"target missed": {
			tags:         map[string]string{TargetPassRateTagKey: "90"},
			status:       controlstatus.StatusSummary{Ok: 3, Alarm: 1},
			expectRate:   f(75),
			expectTarget: f(90),
			expectMet:    b(false),
		},
		"target boundary is inclusive": {
			tags:         map[string]string{TargetPassRateTagKey: "75"},
			status:       controlstatus.StatusSummary{Ok: 3, Alarm: 1},
			expectRate:   f(75),
			expectTarget: f(75),
			expectMet:    b(true),
		},
		"target on an unevaluated benchmark has no verdict": {
			tags:         map[string]string{TargetPassRateTagKey: "75"},
			status:       controlstatus.StatusSummary{Skip: 5},
			expectTarget: f(75),
		},
		"malformed target is ignored": {
			tags:       map[string]string{TargetPassRateTagKey: "abc"},
			status:     controlstatus.StatusSummary{Ok: 3, Alarm: 1},
			expectRate: f(75),
		},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			g := makeScoreGroup("test_group", tt.tags, tt.status)
			g.populateScores()
			assertFloatPtr(t, "PassRate", g.Summary.PassRate, tt.expectRate)
			assertFloatPtr(t, "TargetPassRate", g.Summary.TargetPassRate, tt.expectTarget)
			assertBoolPtr(t, "TargetMet", g.Summary.TargetMet, tt.expectMet)
		})
	}
}

func TestPopulateScoresRootAdoptsSingleChildTarget(t *testing.T) {
	child := makeScoreGroup("benchmark.tagged",
		map[string]string{TargetPassRateTagKey: "90"},
		controlstatus.StatusSummary{Ok: 3, Alarm: 1})
	root := makeScoreGroup(RootResultGroupName, nil,
		controlstatus.StatusSummary{Ok: 3, Alarm: 1})
	root.Groups = []*ResultGroup{child}

	root.populateScores()

	assertFloatPtr(t, "child.TargetPassRate", child.Summary.TargetPassRate, f(90))
	assertBoolPtr(t, "child.TargetMet", child.Summary.TargetMet, b(false))
	// the synthetic root carries no tags, so it adopts its only child's target -
	// this is what the CLI summary and the exit code read
	assertFloatPtr(t, "root.TargetPassRate", root.Summary.TargetPassRate, f(90))
	assertBoolPtr(t, "root.TargetMet", root.Summary.TargetMet, b(false))
}

func TestPopulateScoresRootDoesNotAdoptWithMultipleChildren(t *testing.T) {
	child1 := makeScoreGroup("benchmark.tagged",
		map[string]string{TargetPassRateTagKey: "90"},
		controlstatus.StatusSummary{Ok: 1})
	child2 := makeScoreGroup("benchmark.untagged", nil,
		controlstatus.StatusSummary{Ok: 1})
	root := makeScoreGroup(RootResultGroupName, nil,
		controlstatus.StatusSummary{Ok: 2})
	root.Groups = []*ResultGroup{child1, child2}

	root.populateScores()

	// with several children there is no one target the aggregate could fairly
	// be judged against
	if root.Summary.TargetPassRate != nil {
		t.Fatalf("root adopted a target from one of several children")
	}
	if root.Summary.TargetMet != nil {
		t.Fatalf("root has a verdict with no target")
	}
}

func f(v float64) *float64 { return &v }
func b(v bool) *bool       { return &v }

func assertFloatPtr(t *testing.T, field string, got *float64, expected *float64) {
	t.Helper()
	if (got == nil) != (expected == nil) {
		t.Fatalf("%s = %v, expected %v", field, ptrStr(got), ptrStr(expected))
	}
	if got != nil && *got != *expected {
		t.Fatalf("%s = %v, expected %v", field, *got, *expected)
	}
}

func assertBoolPtr(t *testing.T, field string, got *bool, expected *bool) {
	t.Helper()
	if (got == nil) != (expected == nil) {
		t.Fatalf("%s presence = %v, expected %v", field, got != nil, expected != nil)
	}
	if got != nil && *got != *expected {
		t.Fatalf("%s = %v, expected %v", field, *got, *expected)
	}
}

func ptrStr(v *float64) any {
	if v == nil {
		return nil
	}
	return *v
}
