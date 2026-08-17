package controldisplay

import (
	"fmt"

	"github.com/turbot/go-kit/helpers"
	"github.com/turbot/powerpipe/internal/controlexecute"
)

// SummaryScoreRowRenderer renders the pass rate, and the verdict against the
// benchmark's declared target if it has one.
//
// This exists so that a target can be checked without reading the snapshot: the
// numbers are already in --output json, but a CI step or a human at a terminal
// should not have to parse a document to answer "did we hold 95%".
type SummaryScoreRowRenderer struct {
	resultTree *controlexecute.ExecutionTree
	width      int
}

func NewSummaryScoreRowRenderer(resultTree *controlexecute.ExecutionTree, width int) *SummaryScoreRowRenderer {
	return &SummaryScoreRowRenderer{
		resultTree: resultTree,
		width:      width,
	}
}

// Render returns one row for the rate and, when a target is declared, a second
// for the verdict. Two rows rather than one because the combined line overflows
// the width the rest of the summary block is aligned to, which collapses the
// dot leader and leaves the numbers jammed against the label.
//
// No rows at all when there is no rate to show: a benchmark whose controls all
// skipped has no pass rate, and printing 0% for it would read as total failure.
func (r *SummaryScoreRowRenderer) Render() []string {
	summary := r.resultTree.Root.Summary
	if summary.PassRate == nil {
		return nil
	}

	rows := []string{
		r.renderRow("PASS RATE", fmt.Sprintf("%.1f%%", *summary.PassRate)),
	}

	if summary.TargetPassRate != nil {
		verdict := "MISSED"
		colorFunc := ControlColors.StatusAlarm
		if summary.TargetMet != nil && *summary.TargetMet {
			verdict = "MET"
			colorFunc = ControlColors.StatusOK
		}
		rows = append(rows, r.renderRow(
			"TARGET",
			fmt.Sprintf("%.1f%% %s", *summary.TargetPassRate, colorFunc(verdict)),
		))
	}

	return rows
}

func (r *SummaryScoreRowRenderer) renderRow(label string, value string) string {
	head := fmt.Sprintf("%s ", ControlColors.GroupTitle(label))
	spaceWidth := r.width - (helpers.PrintableLength(head) + helpers.PrintableLength(value))
	return fmt.Sprintf("%s%s%s", head, NewSpacerRenderer(spaceWidth).Render(), value)
}
