// Ensure Table is loaded & registered first
import "@powerpipe/components/dashboards/Table";
import Card, { CardProps } from "@powerpipe/components/dashboards/Card";
import CheckGrouping from "../CheckGrouping";
import CustomizeViewSummary from "../CustomizeViewSummary";
import DashboardTitle from "@powerpipe/components/dashboards/titles/DashboardTitle";
import Error from "@powerpipe/components/dashboards/Error";
import FilterCardWrapper from "@powerpipe/components/dashboards/grouping/FilterCardWrapper";
import Grid from "@powerpipe/components/dashboards/layout/Grid";
import Panel from "@powerpipe/components/dashboards/layout/Panel";
import PanelControls from "@powerpipe/components/dashboards/layout/Panel/PanelControls";
import useFilterConfig from "@powerpipe/hooks/useFilterConfig";
import {
  BenchmarkTreeProps,
  CheckDisplayGroup,
  CheckNode,
  CheckSummary,
} from "../common";
import { CardType } from "@powerpipe/components/dashboards/data/CardDataProcessor";
import { passRateDisplayType } from "@powerpipe/components/dashboards/grouping/common";
import { default as BenchmarkType } from "../common/Benchmark";
import {
  getComponent,
  registerComponent,
} from "@powerpipe/components/dashboards";
import {
  GroupingProvider,
  useBenchmarkGrouping,
} from "@powerpipe/hooks/useBenchmarkGrouping";
import { noop } from "@powerpipe/utils/func";
import {
  PanelControlsProvider,
  usePanelControls,
} from "@powerpipe/hooks/usePanelControls";
import { PanelDefinition } from "@powerpipe/types";
import { useDashboardPanelDetail } from "@powerpipe/hooks/useDashboardPanelDetail";
import { useDashboardState } from "@powerpipe/hooks/useDashboardState";
import { useEffect, useMemo, useState } from "react";
import { Width } from "@powerpipe/components/dashboards/common";

const Table = getComponent("table");

type BenchmarkTableViewProps = {
  benchmark: BenchmarkType;
  definition: PanelDefinition;
};

type InnerCheckProps = {
  benchmark: BenchmarkType;
  definition: PanelDefinition;
  grouping: CheckNode;
  groupingConfig: CheckDisplayGroup[];
  firstChildSummaries: CheckSummary[];
  withTitle: boolean;
};

const Benchmark = (props: InnerCheckProps) => {
  const {
    filter: { expressions },
  } = useFilterConfig(props.definition?.name);
  const { selectedPanel } = useDashboardPanelDetail();
  const benchmarkDataTable = useMemo(() => {
    if (
      !props.benchmark ||
      !props.grouping ||
      props.grouping.status !== "complete"
    ) {
      return undefined;
    }
    return props.benchmark.get_data_table();
  }, [props.benchmark, props.grouping]);
  const [referenceElement, setReferenceElement] = useState(null);
  const {
    enabled: panelControlsEnabled,
    panelControls: benchmarkControls,
    showPanelControls,
    setCustomControls,
    setPanelData,
    setShowPanelControls,
  } = usePanelControls();
  const { overlayVisible } = useDashboardState();
  const { selectSidePanel } = useDashboardPanelDetail();

  useEffect(() => {
    setCustomControls([
      {
        key: "filter-and-group",
        title: "Filter & Group",
        component: <CustomizeViewSummary panelName={props.definition.name} />,
        action: async () =>
          selectSidePanel({
            panel: props.definition,
          }),
      },
    ]);
  }, [props.definition.name, setCustomControls]);

  useEffect(() => {
    if (!benchmarkDataTable) {
      return;
    }
    setPanelData(benchmarkDataTable);
  }, [benchmarkDataTable, setPanelData]);

  const summaryCards = useMemo(() => {
    if (!props.grouping) {
      return [];
    }

    const totalSummary = props.firstChildSummaries.reduce(
      (cumulative, current) => {
        cumulative.error += current.error;
        cumulative.alarm += current.alarm;
        cumulative.ok += current.ok;
        cumulative.info += current.info;
        cumulative.skip += current.skip;
        return cumulative;
      },
      { error: 0, alarm: 0, ok: 0, info: 0, skip: 0 },
    );

    const summary_cards = [
      {
        name: `${props.definition.name}.container.summary.status.ok`,
        width: 2,
        display_type: totalSummary.ok > 0 ? "ok" : "skip",
        properties: {
          label: "OK",
          value: totalSummary.ok,
          icon: "materialsymbols-solid:check_circle",
        },
      },
      {
        name: `${props.definition.name}.container.summary.status.alarm`,
        width: 2,
        display_type: totalSummary.alarm > 0 ? "alert" : "skip",
        properties: {
          label: "Alarm",
          value: totalSummary.alarm,
          icon: "materialsymbols-solid:circle_notifications",
        },
      },
      {
        name: `${props.definition.name}.container.summary.status.error`,
        width: 2,
        display_type: totalSummary.error > 0 ? "alert" : "skip",
        properties: {
          label: "Error",
          value: totalSummary.error,
          icon: "materialsymbols-solid:error",
        },
      },
      {
        name: `${props.definition.name}.container.summary.status.info`,
        width: 2,
        display_type: totalSummary.info > 0 ? "info" : "skip",
        properties: {
          label: "Info",
          value: totalSummary.info,
          icon: "materialsymbols-solid:info",
        },
      },
      {
        name: `${props.definition.name}.container.summary.status.skip`,
        width: 2,
        display_type: "skip",
        properties: {
          label: "Skipped",
          value: totalSummary.skip,
          icon: "materialsymbols-solid:arrow_circle_right",
        },
      },
    ];

    const severity_summary = props.grouping.severity_summary;
    const criticalRaw = severity_summary["critical"];
    const highRaw = severity_summary["high"];
    const critical = criticalRaw || 0;
    const high = highRaw || 0;

    // If we have at least 1 critical or undefined control defined in this run
    if (criticalRaw !== undefined || highRaw !== undefined) {
      const total = critical + high;
      summary_cards.push({
        name: `${props.definition.name}.container.summary.severity`,
        width: 2,
        display_type: total > 0 ? "severity" : "",
        properties: {
          label: "Critical / High",
          value: total,
          icon: "materialsymbols-solid:warning",
        },
      });
    }
    // PASS RATE, weighted by whatever the top-level grouping is.
    //
    // Two different weightings are available, and which one is right depends on
    // how the tree is currently grouped:
    //
    //   by RESULT ROW   - sum the five ints in totalSummary. A resource that
    //                     five controls inspect counts five times.
    //   by GROUP        - count first-level CHILDREN. StatusSummary cannot
    //                     dedupe (five ints, no identity), but the grouping tree
    //                     already did: group by resource and each child IS one
    //                     distinct resource, so counting children yields a
    //                     distinct-resource rate that summing ints cannot.
    //
    // The group weighting is used whenever there is a real grouping dimension,
    // so the headline answers the question the reader just asked by choosing it:
    // grouped by resource it reads per-resource, by domain it reads per-domain.
    // Row weighting is the fallback for a flat (result-only) view.
    //
    // The dimension is the first grouping entry that is not "benchmark" (the
    // root IS the benchmark, so its children are the next level down) and not
    // "result" (leaves, which are the row-weighted case anyway).
    const passedRows = totalSummary.ok + totalSummary.info;
    const failedRows = totalSummary.alarm + totalSummary.error;
    const evaluatedRows = passedRows + failedRows;

    let groupPassed = 0;
    let groupFailed = 0;
    for (const childSummary of props.firstChildSummaries) {
      // A child fails if anything beneath it alarmed or errored, and passes only
      // if it was actually evaluated. Skip-only children count as neither, for
      // the same reason skips leave the row-level denominator.
      if (childSummary.alarm + childSummary.error > 0) {
        groupFailed += 1;
      } else if (childSummary.ok + childSummary.info > 0) {
        groupPassed += 1;
      }
    }
    const groupEvaluated = groupPassed + groupFailed;

    // Take the dimension from the ACTUAL first-level children, not from
    // groupingConfig. Config alone is ambiguous: with a grouping of
    // [benchmark, control, result] the children are benchmarks if this benchmark
    // has sub-benchmarks, and controls if it does not - the root is itself a
    // benchmark, so that level may or may not consume an entry. Reading the
    // child node type is true in both cases.
    //
    // A control_tag child carries the tag KEY (e.g. "domain") separately from
    // its value, and the node type alone would only say "control_tag", so the
    // key is recovered from the matching groupingConfig entry for the label.
    const firstChild = (props.grouping.children || [])[0];
    const childType = firstChild ? firstChild.type : undefined;

    let dimensionLabel: string | undefined = undefined;
    if (childType && childType !== "result") {
      if (childType === "control_tag" || childType === "dimension") {
        const configEntry = (props.groupingConfig || []).find(
          (g) => g.type === childType,
        );
        dimensionLabel = (configEntry && configEntry.value) || childType;
      } else {
        dimensionLabel = childType;
      }
    }

    const useGroupWeighting = !!dimensionLabel && groupEvaluated > 0;

    const rateLabel = useGroupWeighting
      ? `Pass Rate by ${dimensionLabel}`
      : "Pass Rate";
    const ratePassed = useGroupWeighting ? groupPassed : passedRows;
    const rateEvaluated = useGroupWeighting ? groupEvaluated : evaluatedRows;

    // The rate leads the summary row rather than trailing it. The five status
    // cards are 10 grid units, so the layout math is:
    //
    //   no severity card:  rate(2) + 5 status(10)            = 12, one exact row
    //   severity card:     rate(4) + 4 status(8)             = 12, then the
    //                      remaining status card + severity  =  4 on row two
    //
    // Appending at width 2 instead (the first attempt) left the rate orphaned
    // alone on a second row, after a first row the status cards had already
    // filled - the headline number in the worst seat in the house. Leading and
    // width-4 also stops "Pass Rate by resource" truncating.
    const severityCardShown =
      criticalRaw !== undefined || highRaw !== undefined;

    // Rendered unconditionally, the way the five status cards are: nothing was
    // evaluated is a result, not an absence, and a card that comes and goes
    // moves every other card on the row with it. When there is no rate to show
    // it greys out via the "skip" display type and reads "-", which is what a
    // zero-valued status card already does.
    const rateEvaluatedAny = rateEvaluated > 0;
    summary_cards.unshift({
      name: `${props.definition.name}.container.summary.pass_rate`,
      width: severityCardShown ? 4 : 2,
      display_type: rateEvaluatedAny
        ? passRateDisplayType(totalSummary, props.grouping.severity_summary)
        : "skip",
      properties: {
        label: rateLabel,
        value: rateEvaluatedAny
          ? `${((100 * ratePassed) / rateEvaluated).toFixed(1)}%`
          : "-",
        icon: "materialsymbols-solid:percent",
      },
    });

    return summary_cards;
  }, [
    props.firstChildSummaries,
    props.grouping,
    props.groupingConfig,
    props.definition.name,
  ]);

  if (!props.grouping) {
    return null;
  }

  return (
    <Grid
      name={props.definition.name}
      width={props.definition.width}
      events={{
        onMouseEnter: panelControlsEnabled
          ? () => setShowPanelControls(true)
          : noop,
        onMouseLeave: () => setShowPanelControls(false),
      }}
      setRef={setReferenceElement}
    >
      {/*Don't show when in panel detail view*/}
      {!selectedPanel && (
        <DashboardTitle
          title={props.definition.title}
          controls={
            showPanelControls && !overlayVisible ? (
              <PanelControls
                referenceElement={referenceElement}
                controls={benchmarkControls}
              />
            ) : null
          }
        />
      )}
      <Grid name={`${props.definition.name}.container.summary`}>
        {summaryCards
          .filter(({ name }) => {
            const statusFilter = expressions?.find(
              (expr) => expr.type === "status",
            );
            const statusType = name.split(".")[name.split(".").length - 1];
            if (
              statusType !== "severity" &&
              statusFilter &&
              statusFilter.operator === "equal"
            ) {
              return statusType === statusFilter.value;
            } else if (
              statusType !== "severity" &&
              statusFilter &&
              statusFilter.operator === "not_equal"
            ) {
              return statusType !== statusFilter.value;
            } else if (
              statusType !== "severity" &&
              statusFilter &&
              statusFilter.operator === "in"
            ) {
              return statusFilter.value?.includes(statusType);
            } else if (
              statusType !== "severity" &&
              statusFilter &&
              statusFilter.operator === "not_in"
            ) {
              return !statusFilter.value?.includes(statusType);
            }
            return true;
          })
          .map((summaryCard) => {
            const cardProps: CardProps = {
              name: summaryCard.name,
              dashboard: props.definition.dashboard,
              display_type: summaryCard.display_type as CardType,
              panel_type: "card",
              properties: summaryCard.properties,
              status: "complete",
              width: summaryCard.width as Width,
            };
            return (
              <Panel
                key={summaryCard.name}
                definition={cardProps}
                parentType="benchmark"
              >
                <FilterCardWrapper
                  cardName={summaryCard.name}
                  panelName={props.definition.name}
                  dimension={
                    summaryCard.display_type === "severity"
                      ? "severity"
                      : "status"
                  }
                  expressions={expressions}
                >
                  <Card {...cardProps} />
                </FilterCardWrapper>
              </Panel>
            );
          })}
      </Grid>
      <Grid name={`${props.definition.name}.container.tree`}>
        <BenchmarkTree
          name={`${props.definition.name}.container.tree.results`}
          dashboard={props.definition.dashboard}
          panel_type="benchmark_tree"
          properties={{
            grouping: props.grouping,
            first_child_summaries: props.firstChildSummaries,
          }}
          status="complete"
        />
      </Grid>
    </Grid>
  );
};

const BenchmarkTree = (props: BenchmarkTreeProps) => {
  if (!props.properties || !props.properties.first_child_summaries) {
    return null;
  }

  return <CheckGrouping node={props.properties.grouping} />;
};

const BenchmarkTableView = ({
  benchmark,
  definition,
}: BenchmarkTableViewProps) => {
  const benchmarkDataTable = useMemo(
    () => benchmark.get_data_table(),
    [benchmark],
  );

  return (
    <Panel
      definition={{
        name: definition.name,
        dashboard: definition.dashboard,
        panel_type: "table",
        width: definition.width,
        children: definition.children,
        data: benchmarkDataTable,
        status: benchmarkDataTable ? "complete" : "running",
      }}
      parentType="benchmark"
    >
      <Table
        name={`${definition.name}.table`}
        panel_type="table"
        data={benchmarkDataTable}
      />
    </Panel>
  );
};

const Inner = ({ withTitle }) => {
  const {
    benchmark,
    definition,
    grouping,
    groupingConfig,
    firstChildSummaries,
  } = useBenchmarkGrouping();

  if (!definition || !benchmark || !grouping) {
    return null;
  }

  if (!definition.display_type || definition.display_type === "benchmark") {
    return (
      <Benchmark
        benchmark={benchmark}
        definition={definition}
        grouping={grouping}
        groupingConfig={groupingConfig}
        firstChildSummaries={firstChildSummaries}
        withTitle={withTitle}
      />
    );
    // @ts-ignore
  } else if (definition.display_type === "table") {
    return <BenchmarkTableView benchmark={benchmark} definition={definition} />;
  } else {
    return (
      <Panel
        definition={{
          name: definition.name,
          dashboard: definition.dashboard,
          panel_type: "benchmark",
          width: definition.width,
          status: "error",
        }}
        parentType="benchmark"
      >
        <Error
          error={`Unsupported benchmark type ${definition.display_type}`}
        />
      </Panel>
    );
  }
};

type BenchmarkProps = {
  definition: PanelDefinition;
  benchmarkChildren?: PanelDefinition[] | undefined;
  showControls: boolean;
  withTitle: boolean;
};

const BenchmarkWrapper = (props: BenchmarkProps) => {
  return (
    <GroupingProvider
      definition={props.definition}
      benchmarkChildren={props.benchmarkChildren}
    >
      <PanelControlsProvider
        definition={props.definition}
        enabled={props.showControls}
      >
        <Inner withTitle={props.withTitle} />
      </PanelControlsProvider>
    </GroupingProvider>
  );
};

registerComponent("benchmark", BenchmarkWrapper);

export default BenchmarkWrapper;
