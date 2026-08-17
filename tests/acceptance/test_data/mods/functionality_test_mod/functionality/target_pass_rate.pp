# Benchmarks for the target_pass_rate tag, which grades the run against a
# declared pass rate instead of failing on any alarm.
#
# All three share the same shape: some controls pass, one alarms, so the
# row-weighted pass rate is 3/4 = 75%. Only the declared target differs.

benchmark "target_met_with_alarms" {
  title       = "Pass rate 75% against a target of 60"
  description = "Benchmark to verify a met target exits 0 even though a control is in alarm"
  children = [
    control.target_ok_1,
    control.target_ok_2,
    control.target_ok_3,
    control.target_alarm_1
  ]
  tags = {
    target_pass_rate = "60"
  }
}

benchmark "target_missed" {
  title       = "Pass rate 75% against a target of 90"
  description = "Benchmark to verify a missed target exits 1"
  children = [
    control.target_ok_1,
    control.target_ok_2,
    control.target_ok_3,
    control.target_alarm_1
  ]
  tags = {
    target_pass_rate = "90"
  }
}

benchmark "target_with_error" {
  title       = "Control error under a declared target"
  description = "Benchmark to verify control errors exit 2 regardless of the target"
  children = [
    control.target_ok_1,
    control.target_error_1
  ]
  tags = {
    target_pass_rate = "10"
  }
}

control "target_ok_1" {
  title    = "Passing control for target pass rate tests"
  query    = query.target_ok_query
  severity = "high"
}

control "target_ok_2" {
  title    = "Passing control for target pass rate tests"
  query    = query.target_ok_query
  severity = "high"
}

control "target_ok_3" {
  title    = "Passing control for target pass rate tests"
  query    = query.target_ok_query
  severity = "high"
}

control "target_alarm_1" {
  title    = "Alarming control for target pass rate tests"
  query    = query.target_alarm_query
  severity = "low"
}

control "target_error_1" {
  title = "Erroring control for target pass rate tests"
  sql   = "select * from table_that_does_not_exist_target_test"
}

query "target_ok_query" {
  title = "target_ok_query"
  sql   = "select 'ok' as status, 'steampipe' as resource, 'acceptance tests' as reason"
}

query "target_alarm_query" {
  title = "target_alarm_query"
  sql   = "select 'alarm' as status, 'steampipe' as resource, 'acceptance tests' as reason"
}
