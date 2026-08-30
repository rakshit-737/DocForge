[toc]

[lof]

[lot]

[pagebreak]

# Executive summary {#sec:summary}

The Helios programme moves the Meridian transaction platform out of the Ashford data centre
and onto the two-region cloud footprint approved by the Technology Board in July 2025. This
report records the state of the programme at the close of wave 3, describes the target
architecture as built rather than as designed, and presents the evidence gathered during four
weeks of soak testing[^scope]. It is written for the programme board and for the service
owners who will operate the platform after handover; the appended references identify the
published material the engineering decisions lean on.

==All twenty-six in-scope services now run in the target environment==, and the remaining
work concerns decommissioning rather than migration. The estate described in [#sec:estate]
has been reduced from fourteen racks to the four that host the interconnect and the tape
robot, and the programme remains inside its approved envelope, as [#tbl:costs] shows in
detail. The lease on hall B ends on ++30 June 2026++ and cannot be extended, so the
decommissioning schedule in [#sec:recommendations] is not discretionary.

Two findings deserve the board's attention ahead of the detail. First, the platform's
measured behaviour under the reference load is materially better than the acceptance
thresholds: the p95 settlement latency fell from 412 ms to 187 ms, and the sustained
throughput ceiling roughly doubled. Second, the residual risk register ([#sec:risk]) is
short but not empty; the two amber items both concern the period between now and the hall B
exit, not the steady state.

The engineering approach follows the pattern literature closely: incremental strangler-style
movement of services rather than a single cutover event [@kleppmann2017], with error budgets
and rollback rehearsals treated as first-class deliverables [@beyer2016]. The structure of
this document mirrors the programme itself: [#sec:approach] describes how services moved,
[#sec:validation] describes how the result was measured, and [#sec:cost] accounts for what
it cost.

# Programme background {#sec:background}

Meridian processes card-present and card-not-present transactions for the retail estate,
clears them against three acquirer connections, and settles nightly. It has run in the
Ashford data centre since 2014, growing by accretion: what began as nine services on
dedicated hardware became, by the September 2025 baseline audit, sixty-one deployable units
on a mixture of physical hosts and a small VMware cluster. Twenty-six of those units carry
production traffic and are in scope for Helios; the remainder are batch reporting jobs that
retire with the legacy warehouse.

## The Ashford estate {#sec:estate}

The baseline audit counted every powered device in halls A and B, traced each to a service
owner, and classified it by disposition. The summary is reproduced here because the numbers
frame every later decision: the platform is small enough to move in waves but old enough
that almost nothing can move unchanged.

[table: Ashford data centre estate at the September 2025 baseline | #tbl:estate]

| Category | Count | Avg. age | Disposition | Notes |
| :--- | ---: | ---: | :--- | :--- |
| Physical application hosts | 38 | 7.2 y | Replatform | Out of vendor support since 2023 |
| VMware guests | 214 | 4.1 y | Replatform | Cluster licence expires June 2026 |
| Database servers | 9 | 6.8 y | Re-engineer | Two engines, five major versions |
| Load balancers | 4 | 8.0 y | Retire | Function moves to managed service |
| Message brokers | 6 | 5.5 y | Re-engineer | Custom persistence patches applied |
| Storage arrays | 3 | 7.9 y | Retire | 1.9 PB raw, 41 % utilised |
| Network switches | 22 | 9.1 y | Retire | Spanning tree topology, no automation |
| Tape library | 1 | 11.3 y | Retain | Regulatory archive until 2032 |

The age profile matters more than the count. A seven-year-old host can be imaged and copied;
a seven-year-old operating system with hand-applied patches cannot be reproduced, which is
why the programme rejected lift-and-shift for every category except the stateless edge
proxies. The audit's rack elevations are archived with the programme records; the summary
view is shown in [#fig:estate].

[screenshot: Rack elevation summary of halls A and B at the September 2025 baseline | #fig:estate]

## Drivers for migration {#sec:drivers}

Four pressures converged on the same eighteen-month horizon, and any one of them alone
would have forced the programme:

- The hall B lease expires and the landlord has served notice of redevelopment; there is
  no renewal option to exercise.
- The VMware estate faces a licensing change that would have multiplied the annual cost by
  a factor the service could not absorb.
- The card scheme's operational resilience requirements now demand a demonstrable
  regional failover, which the single-site estate cannot provide at any price.
- Recruitment: the platform's operating knowledge is concentrated in four engineers, two
  of whom have signalled retirement before 2027.

The resilience requirement is the deep one. Continuous delivery practice assumes an
environment that can be rebuilt from declaration [@humble2010], and incident experience
across the industry shows that recovery procedures which are not exercised routinely do not
work when invoked [@nygard2018]. Ashford offered neither property; the target platform was
designed around both.

## Constraints and exclusions {#sec:constraints}

The programme board fixed three constraints at initiation, and they held throughout.
Settlement cutoff times are contractual and could not move; no migration window was
permitted to overlap the November trading peak; and the regulatory archive stays on tape,
on premises, until the retention clock runs out.

:::note Scope boundaries
The following are explicitly out of scope for Helios and are recorded here to prevent
scope drift in later phases:

- The legacy reporting warehouse, which retires with its consumers in 2027
- The office network and end-user computing estate at Ashford
- Any change to acquirer connectivity contracts, which renew separately in 2028
:::

[pagebreak]

# Target architecture {#sec:architecture}

The target platform runs active-active across two cloud regions, with the settlement
pipeline pinned to a primary region and rehearsed failover to the secondary. The design
principle throughout is that the platform must be reconstructible from its repository: every
component is declared, every declaration is versioned, and no production change is applied
by hand. The subsections below describe the three layers in turn; the assembled topology is
shown in [#fig:topology].

## Compute and orchestration {#sec:compute}

All twenty-six services run as containers on a managed Kubernetes distribution, one cluster
per region, with namespaces mirroring the service ownership boundaries that already existed
organisationally. Workload identity replaces the shared service accounts that Ashford
accumulated, which closes the oldest finding on the security register. A representative
deployment declaration, abbreviated to its load-bearing fields, reads as follows:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: settlement-engine
  namespace: clearing
  labels:
    helios.arden.example/wave: "2"
spec:
  replicas: 6
  strategy:
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 2
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
      containers:
        - name: engine
          image: registry.arden.example/clearing/settlement-engine:2.14.3
          resources:
            requests: { cpu: "2", memory: 4Gi }
            limits: { cpu: "4", memory: 6Gi }
```

The spread constraint is not decoration. During the wave 2 game day the platform lost a
full availability zone for forty minutes, and the settlement engine kept its replica count
without operator action; the equivalent event at Ashford in 2022 was a four-hour outage.

[screenshot: Target platform topology across the two cloud regions | w:70% | #fig:topology]

## Data layer {#sec:data}

The nine database servers at Ashford ran two engines across five major versions, each
tuned by hand over a decade. Rather than reproduce that variety, the programme consolidated
onto a managed relational service for transactional state and a managed log store for the
event streams, and re-engineered the two services whose schemas could not survive the
version jump. The disposition of each store is recorded in [#tbl:datastores].

Sizing was modelled before commitment rather than discovered afterwards. Treating each
acquirer connection as an independent arrival source, the offered load ratio is
$\rho = \lambda / \mu$, and the steady-state queue length that the broker tier must absorb
follows the standard result:

$$L_q = \frac{\rho^2}{1 - \rho}$$

At the contractual peak of 340 transactions per second against a measured single-node
service rate of 520 per second, the model predicted comfortable headroom on three nodes and
degraded-but-survivable behaviour on two; the wave 3 soak in [#sec:results] confirmed both
predictions within 8 %.

[table: Datastore disposition by service group | #tbl:datastores]

| Service group | Ashford store | Target store | Method |
| :--- | :--- | :--- | :--- |
| Clearing | Oracle 12c, 2 nodes | Managed PostgreSQL 16 | Schema conversion and dual-run |
| Settlement | Oracle 19c, 2 nodes | Managed PostgreSQL 16 | Logical replication |
| Merchant profile | MySQL 5.7, 2 nodes | Managed MySQL 8 | Native replica promotion |
| Event streams | Custom broker, 6 nodes | Managed Kafka | Mirror then re-point consumers |
| Session cache | Memcached, 3 nodes | Managed Redis | Rebuilt cold at cutover |

## Network and interconnect {#sec:network}

Connectivity to the acquirers is the platform's hardest external dependency: the circuits
terminate physically at Ashford and re-terminating them is a multi-quarter carrier exercise
that gates the final exit. Until then, a pair of redundant private interconnects carries
acquirer traffic from Ashford's meet-me room into the primary region, with the health of
both paths probed continuously. The probe harness is deliberately unsophisticated, and its
core loop is reproduced here because auditors asked to see it:

```bash
#!/usr/bin/env bash
# Probe both interconnect paths and record round-trip health.
set -euo pipefail

TARGETS="10.40.8.1 10.44.8.1"
for target in $TARGETS; do
  if rtt=$(ping -c 3 -W 1 -q "$target" | awk -F/ '/^rtt/ {print $5}'); then
    echo "$(date -u +%FT%TZ) $target ok ${rtt}ms"
  else
    echo "$(date -u +%FT%TZ) $target FAIL"
    logger -t helios-probe "interconnect path $target failed probe"
  fi
done
```

The failover behaviour of the paired paths was tested destructively during wave 2 by
administratively downing the primary circuit under production-shaped load. Convergence
completed in 1.8 s with no transaction loss; the capture from that test is reproduced in
[#fig:failover], and the procedure is now rehearsed quarterly.

[screenshot: Interconnect failover test capture, wave 2 game day | noborder | #fig:failover]

# Migration approach {#sec:approach}

Helios moved services in four waves ordered by blast radius: stateless and internal first,
settlement-critical last. Each wave followed the same contract: build in the target, dual-run
against production traffic where the service shape allowed it, cut over inside an agreed
window, and hold a rollback path open until the exit criteria were signed. No wave was
permitted to begin while its predecessor held an open severity-one action.

## Wave planning {#sec:waves}

The full assignment of services to waves is recorded in [#tbl:waves]. The table is long,
and deliberately so: it is the single artefact the programme office, the service owners and
the auditors all worked from, and this report reproduces it unabridged rather than
summarising it. Criticality follows the service catalogue's standard scale, where C1
denotes a service whose failure halts settlement.

[table: Migration wave assignments for all twenty-six in-scope services | #tbl:waves]

| Wave | Service | Criticality | Method | Cutover window | Outcome |
| :---: | :--- | :---: | :--- | :--- | :--- |
| 1 | Static content edge | C4 | Redeploy | 2025-11-04, 22:00 | Complete |
| 1 | Merchant portal frontend | C3 | Redeploy | 2025-11-04, 22:00 | Complete |
| 1 | Internal admin console | C4 | Redeploy | 2025-11-05, 22:00 | Complete |
| 1 | Document render service | C4 | Redeploy | 2025-11-05, 22:00 | Complete |
| 1 | Notification dispatcher | C3 | Redeploy | 2025-11-06, 22:00 | Complete |
| 1 | Rate card service | C3 | Redeploy | 2025-11-06, 22:00 | Complete |
| 2 | Merchant profile API | C2 | Dual-run | 2025-12-02, 23:00 | Complete |
| 2 | Session gateway | C2 | Dual-run | 2025-12-02, 23:00 | Complete |
| 2 | Tokenisation service | C2 | Dual-run | 2025-12-03, 23:00 | Complete |
| 2 | Fraud scoring adapter | C2 | Dual-run | 2025-12-03, 23:00 | Complete |
| 2 | Event stream brokers | C2 | Mirror | 2025-12-09, 23:00 | Complete |
| 2 | Reconciliation API | C2 | Dual-run | 2025-12-10, 23:00 | Complete |
| 2 | Dispute intake service | C3 | Redeploy | 2025-12-10, 23:00 | Complete |
| 3 | Clearing engine | C1 | Dual-run | 2026-01-20, 01:00 | Complete |
| 3 | Settlement engine | C1 | Dual-run | 2026-01-21, 01:00 | Complete |
| 3 | Acquirer link handler A | C1 | Staged re-point | 2026-01-27, 01:00 | Complete |
| 3 | Acquirer link handler B | C1 | Staged re-point | 2026-01-28, 01:00 | Complete |
| 3 | Acquirer link handler C | C1 | Staged re-point | 2026-02-03, 01:00 | Complete |
| 3 | Ledger posting service | C1 | Dual-run | 2026-02-04, 01:00 | Complete |
| 3 | Settlement file emitter | C1 | Dual-run | 2026-02-10, 01:00 | Complete |
| 4 | Batch fee calculator | C3 | Redeploy | 2026-02-24, 22:00 | Complete |
| 4 | Statement generator | C3 | Redeploy | 2026-02-24, 22:00 | Complete |
| 4 | Chargeback processor | C2 | Dual-run | 2026-03-03, 23:00 | Complete |
| 4 | Archive gateway | C3 | Redeploy | 2026-03-04, 22:00 | Complete |
| 4 | Metrics aggregator | C4 | Redeploy | 2026-03-04, 22:00 | Complete |
| 4 | Alert routing service | C3 | Redeploy | 2026-03-05, 22:00 | Complete |

Two scheduling decisions in the table repay attention. The acquirer link handlers were
spaced a week apart even though each cutover took under an hour, because the exit criterion
for each was a full settlement cycle observed clean, not merely a successful re-point. And
wave 4 trails the critical path deliberately: nothing in it gates the hall B exit, so its
windows were placed where they could be cancelled without consequence.

## Cutover procedure {#sec:cutover}

Every cutover ran from the same rehearsed procedure, parameterised per service. The
sequence that follows is the C1 variant; lower criticalities omit the shadow-comparison
step but change nothing else.

1. Freeze the service's deployment pipeline and announce the window in the operations
   channel, naming the approver and the abort authority.
2. Verify replication or dual-run convergence:
   1. Confirm the target store's replication lag has held below 500 ms for the preceding
      hour.
   2. Run the shadow comparison and confirm a mismatch rate below one in 10^6^ requests.
3. Re-point traffic at the target, in 10 % increments for C1 services, watching the error
   budget burn rate between increments.
4. Observe one complete settlement cycle, then either sign the exit criteria or invoke
   rollback ([#sec:rollback]).

The traffic re-point itself is a single idempotent command,
`helios-cutover run --service settlement-engine --step 10`, and its audit log is written
to the programme record before the window closes. The full runbook set is published on
[the programme wiki](https://wiki.arden.example/helios/runbooks) and versioned alongside
the platform declarations.

:::important Freeze window discipline
During any C1 window the deployment pipeline freeze is enforced technically, not socially.
The admission controller rejects every deploy whose window annotation is absent or expired:

```sql
SELECT service, requested_by, denied_at
FROM   admission_log
WHERE  verdict = 'DENIED'
AND    denied_at BETWEEN '2026-01-20' AND '2026-02-11'
ORDER  BY denied_at;
```

The query above returned eleven rows across wave 3 -- eleven deploys that would previously
have relied on someone remembering the freeze.
:::

## Rollback provisions {#sec:rollback}

A rollback that has never been executed is a hypothesis, not a control [@nygard2018]. Each
wave therefore rehearsed its rollback against production-shaped load in the week before its
first window, and the C1 services rehearsed twice. Rollback authority sat with the named
abort authority for the window, never with the migration engineer, so the person under
schedule pressure was structurally not the person deciding whether to proceed.

:::warning Rollback decision points
Rollback ceases to be the default response partway through each window. The decision table
below governed every C1 cutover; past the point of no return, the correct response to a
fault is forward repair in the target, not retreat.

| Phase | Trigger observed | Response |
| :--- | :--- | :--- |
| Increments at 10-50 % | Error budget burn above 2x | Roll back, hold 24 h |
| Increments at 60-90 % | Error budget burn above 2x | Roll back, convene review |
| Settlement cycle open | Any C1 fault | Forward repair only |
| Exit criteria signed | Any fault | Normal incident process |
:::

[pagebreak]

# Performance validation {#sec:validation}

Acceptance was defined before the first wave moved: the platform had to match or better
Ashford's measured behaviour under a reference load derived from production traces, not
from synthetic assumptions. This section records the load model and the soak results that
the sign-off rests on.

## Load model {#sec:load}

The reference load treats each acquirer connection as an independent arrival source and
sums them[^model]. Writing $\lambda_i$ for the fitted peak rate of source $i$ and $\mu$ for
the measured per-node service rate, the model works from the aggregate utilisation and the
resulting queueing delay:

$$
\rho = \frac{1}{m\mu} \sum_{i=1}^{n} \lambda_i ,
\qquad
W_q = \frac{\rho}{\mu(1 - \rho)}
$$

with $m$ nodes serving. The tail is what the acceptance thresholds actually constrain, and
for the fitted model the probability of a settlement request finding $k$ or more requests
queued is $P(N \ge k) = \rho^k$, which at the wave 3 measured utilisation of
$\rho = 0.41$ puts fewer than one request in 10^4^ behind a queue of five or more. The
same arithmetic sized the two-node degraded case that the resilience requirement demands.

## Soak results {#sec:results}

The wave 3 soak ran the reference load continuously for twenty-eight days against the
completed platform, with Ashford still dual-running as the comparison baseline for the
first fourteen. The headline series are tabulated in [#tbl:soak] and the latency
distributions are plotted in [#fig:latency]; the queueing delay component W~q~ tracked the
model's prediction throughout, and the platform processed 1.9 x 10^9^ transactions over
the soak without a severity-one incident.

[table: Latency and throughput during the wave 3 soak, against Ashford baseline | #tbl:soak]

| Measure | Ashford baseline | Target, soak | Change | Threshold |
| :--- | ---: | ---: | ---: | ---: |
| Settlement latency, p50 | 118 ms | 64 ms | -46 % | 150 ms |
| Settlement latency, p95 | 412 ms | 187 ms | -55 % | 450 ms |
| Settlement latency, p99.9 | 2,340 ms | 610 ms | -74 % | 2,500 ms |
| Sustained throughput ceiling | 390 tps | 780 tps | +100 % | 400 tps |
| Failed settlement rate | 0.0041 % | 0.0009 % | -78 % | 0.0050 % |
| Regional failover, observed | not possible | 118 s | n/a | 300 s |

[screenshot: Settlement latency distribution, Ashford baseline against wave 3 soak | w:80% | #fig:latency]

### Latency at the tail {#sec:tail}

The p99.9 improvement is the one that changes operational life. At Ashford the extreme
tail was dominated by storage array contention during the nightly batch overlap, a
structural fact no tuning could remove. In the target the tail is dominated by ordinary
retry behaviour, it responds to code changes, and the on-call rota has not been paged for
latency since the soak began.

### Sustained throughput {#sec:throughput}

The doubled ceiling was not a goal, and the report is careful not to present it as
delivered value: it is headroom, purchased incidentally by right-sizing. Its worth is
optionality -- the peak-season capacity review that Ashford forced annually is now a
non-event, and the finance model in [#sec:cost] deliberately claims no benefit for it.

# Risk register {#sec:risk}

The programme-level register closed forty-one risks over the four waves. The residual
items at the time of writing are reproduced in [#tbl:risks]; the two amber entries both
expire with the hall B exit and are tracked weekly by the programme office.

[table: Residual risks at the close of wave 3 | #tbl:risks]

| Ref | Risk | Likelihood | Impact | Status | Owner |
| :--- | :--- | :---: | :---: | :---: | :--- |
| R-07 | Carrier delays acquirer circuit re-termination | Medium | High | Amber | Network lead |
| R-12 | Hall B decommission slips past lease expiry | Low | High | Amber | Programme office |
| R-19 | Managed Kafka version forced upgrade mid-2026 | Medium | Low | Green | Platform lead |
| R-23 | Tape archive restore drill overdue | Low | Medium | Green | Operations |
| R-31 | Key-person dependency on legacy Oracle knowledge | Low | Low | Green | Engineering manager |

:::tip Reading the register
Likelihood and impact use the corporate three-point scale. A risk is retired, not deleted:
the full register with closure evidence for all forty-one items remains in the programme
records and is the artefact internal audit samples from.
:::

# Cost position {#sec:cost}

The programme closes wave 3 at 91 % of its approved envelope with all migration work
complete; the remaining spend is decommissioning labour and the carrier re-termination
charge. The comparison that matters for the board is annual run cost, and it is presented
conservatively: the target column includes the interconnect that exists only until exit,
and claims nothing for the throughput headroom noted in [#sec:throughput].

[table: Programme cost against the approved envelope, and annual run cost | #tbl:costs]

| Line | Approved | Actual to date | Forecast at close |
| :--- | ---: | ---: | ---: |
| Migration engineering | 2,400 kGBP | 2,210 kGBP | 2,340 kGBP |
| Cloud consumption, programme period | 610 kGBP | 545 kGBP | 590 kGBP |
| Interconnect and carrier charges | 180 kGBP | 122 kGBP | 175 kGBP |
| Decommissioning and disposal | 240 kGBP | 31 kGBP | 225 kGBP |
| Contingency | 340 kGBP | 0 kGBP | 90 kGBP |
| Total programme | 3,770 kGBP | 2,908 kGBP | 3,420 kGBP |
| Annual run cost, Ashford (2025 actual) | -- | 1,940 kGBP | -- |
| Annual run cost, target (soak-derived) | -- | -- | 1,310 kGBP |

Discounting the run-cost saving over the five-year horizon the board's standard model
requires, with $C_t = C_0 (1 + r)^{-t}$ at the mandated rate, the programme repays its net
cost in the fourth year. That is slower than the original business case promised, and the
difference is honest: the case assumed a VMware licence shock that the migration itself
made moot [@newman2021, p. 143]. The saving that materialised is real but smaller than the
saving that was avoided.

# Governance and document control {#sec:governance}

Helios ran under the corporate change framework with two programme-specific additions: the
technically enforced freeze windows described in [#sec:cutover], and a standing rule that
no exit criterion could be signed by the engineer who implemented the work it verified.
Internal audit observed the wave 3 windows directly[^audit].

## Approvals and sign-off {#sec:approvals}

This report was reviewed by the platform lead, the network lead and the head of service
operations before submission, and their sign-off covers sections [#sec:architecture]
through [#sec:cost]. The programme board's acceptance of ~~wave 4~~
=={green}waves 3 and 4== was minuted on 12 March 2026; the struck text records a drafting
correction made after the minute was circulated, retained here as the change-control
clause requires.

### Change control {#sec:change}

#### Clause 4.1: revision handling {#sec:clause-revision}

Revisions to an issued report are made by reissue, never by substitution. Superseded text
is retained with strikethrough for one revision cycle, material insertions are highlighted
in the revision colour, and the document control table is updated in the same reissue.

##### Distribution list handling {#sec:distribution}

The distribution list is maintained by the programme office. Copies circulated outside the
list carry the marking [Commercial in confidence]{sc color=#7a1f1f} on the cover and in
the running footer, and are watermarked per the information-handling standard.

###### Archival note {#sec:archival}

The signed original, the soak data extracts and the full risk register deposit to the
corporate archive under retention class R-7; the tape-held regulatory archive at Ashford is
unaffected by this report.

:::center
Issued by the Helios programme office, revision 2.1, 17 April 2026
:::

# Recommendations and next steps {#sec:recommendations}

The programme's remaining work is scheduled and funded, and none of it is novel; the
recommendations below are therefore about protecting the properties the migration bought
rather than adding to them.

> The purpose of a migration is not to arrive somewhere new; it is to become the kind of
> organisation that can leave anywhere. The rehearsed failover, the enforced freeze and the
> reconstructible platform are worth more than the cost line they came in under.

1. Hold the quarterly failover rehearsal on the standing schedule, and treat the first
   missed rehearsal as a board-level exception, not an operational slip.
2. Complete the carrier re-termination before the end of May 2026, keeping R-07 under
   weekly review until the circuits are live in the target region.
3. Exit hall B by 12 June 2026, two weeks inside the lease expiry, and confirm disposal
   certificates for every asset in [#tbl:estate] marked for retirement.
4. Fold the Helios error-budget and freeze-window mechanisms into the standard operating
   model so they survive the programme's closure.

---

The board is asked to note the soak evidence in [#sec:validation], accept the cost
position in [#tbl:costs], and approve the decommissioning schedule above. Nothing in the
residual register prevents proceeding.

# Sources {#sec:sources}

The works cited in this report are listed below. Page-level citations are given where a
specific claim leans on a specific passage; the remainder are cited for the pattern or
practice as a whole.

[@kleppmann2017]: Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media.
[@beyer2016]: Beyer, B., Jones, C., Petoff, J., and Murphy, N. R. (2016). *Site Reliability
    Engineering: How Google Runs Production Systems*. O'Reilly Media.
[@humble2010]: Humble, J., and Farley, D. (2010). *Continuous Delivery: Reliable Software
    Releases through Build, Test, and Deployment Automation*. Addison-Wesley.
[@nygard2018]: Nygard, M. T. (2018). *Release It! Design and Deploy Production-Ready
    Software* (2nd ed.). Pragmatic Bookshelf.
[@newman2021]: Newman, S. (2021). *Building Microservices* (2nd ed.). O'Reilly Media.

[references]

[^scope]: Soak testing ran from 16 March to 12 April 2026 against the reference load
    defined in the acceptance plan; the raw extracts accompany this report in the
    programme records.
[^model]: The load model treats each acquirer connection as an independent Poisson source.
    Aggregate arrival rates were fitted against fourteen weeks of production traces, and
    the fit was re-validated after each wave against observed target-side traffic.
[^audit]: Internal audit reference IA-2026-014; the observation letter is filed with the
    programme records and raised no findings.
