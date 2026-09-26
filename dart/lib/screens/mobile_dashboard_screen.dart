import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/acls_state.dart';
import '../state/acls_state_manager.dart';
import '../constants/acls_constants.dart';

class MobileDashboardScreen extends StatefulWidget {
  const MobileDashboardScreen({super.key});

  @override
  State<MobileDashboardScreen> createState() => _MobileDashboardScreenState();
}

class _MobileDashboardScreenState extends State<MobileDashboardScreen> with TickerProviderStateMixin {
  int _activeTab = 0; // 0: Timers, 1: Drugs, 2: Pathway, 3: Journal, 4: Recs/Sign
  final List<bool> _checkedCauses = List.filled(AclsConstants.hAndTs.length, false);
  final List<Offset> _signaturePoints = [];
  bool _isSigned = false;

  String _formatTime(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return "$m:$s";
  }

  @override
  Widget build(BuildContext context) {
    final stateManager = context.watch<AclsStateManager>();
    final state = stateManager.state;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        title: const Text(
          "ACLS CLINICAL DASHBOARD",
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.0, color: Colors.white),
        ),
        backgroundColor: const Color(0xFF1E293B),
        elevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            // Confirm exit dialog
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: const Color(0xFF1E293B),
                title: const Text("Suspend Resuscitation?", style: TextStyle(color: Colors.white)),
                content: const Text(
                  "Are you sure you want to dismiss the active cycle? This will suspend all registry timelines.",
                  style: TextStyle(color: Colors.grey),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text("Cancel"),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                    onPressed: () {
                      Navigator.pop(ctx); // pop dialog
                      Navigator.pop(context); // exit dashboard
                    },
                    child: const Text("Exit Session"),
                  ),
                ],
              ),
            );
          },
        ),
        actions: [
          Row(
            children: [
              const Icon(Icons.timer, size: 14, color: Colors.grey),
              const SizedBox(width: 4),
              Text(
                _formatTime(state.totalTime),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.blueAccent, fontFamily: 'monospace'),
              ),
              const SizedBox(width: 12),
            ],
          ),
          IconButton(
            icon: Icon(stateManager.soundEnabled ? Icons.volume_up : Icons.volume_off, color: Colors.amber),
            onPressed: stateManager.toggleSound,
          ),
        ],
      ),
      body: Column(
        children: [
          // Metronome Beat Synchronizer Indicator Bar
          if (state.isTimerRunning && state.activePrompt != ActivePrompt.rhythmCheck)
            Container(
              height: 4,
              width: double.infinity,
              color: Colors.blueAccent.withOpacity(0.1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 270),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: (DateTime.now().millisecondsSinceEpoch ~/ 545) % 2 == 0 
                      ? Colors.tealAccent 
                      : Colors.transparent,
                ),
              ),
            ),

          // Core Clinical Metrics Grid
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
            color: const Color(0xFF1E293B),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildStatBadge(
                  icon: Icons.flash_on,
                  label: "SHOCKS",
                  value: "${state.shocksCount}",
                  color: Colors.redAccent,
                ),
                _buildStatBadge(
                  icon: Icons.science,
                  label: "EPI DOSES",
                  value: "${state.epiCount}",
                  color: Colors.amberAccent,
                ),
                _buildStatBadge(
                  icon: Icons.refresh,
                  label: "CPR ROUNDS",
                  value: "${state.cprCycleCount + 1}",
                  color: Colors.greenAccent,
                ),
              ],
            ),
          ),

          // Epinephrine Due Alert Notification (every 7 seconds)
          if (state.activePrompt == ActivePrompt.epiDue)
            _buildEpiNotificationBanner(context, state, stateManager),

          // Rhythm Check Alert (Assessment Pause)
          if (state.activePrompt == ActivePrompt.rhythmCheck)
            _buildRhythmCheckBanner(context, state, stateManager),

          // Shock Advised Alert
          if (state.activePrompt == ActivePrompt.shockAdvised)
            _buildShockAdvisedBanner(context, state, stateManager),

          // Epinephrine Required Guideline
          if (state.activePrompt == ActivePrompt.epiAdvised)
            _buildEpiAdvisedBanner(context, state, stateManager),

          // Main Screen tab panels
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: _renderActiveTab(state, stateManager),
            ),
          ),

          // Bottom navigation tabs
          BottomNavigationBar(
            currentIndex: _activeTab,
            onTap: (index) {
              setState(() {
                _activeTab = index;
              });
            },
            backgroundColor: const Color(0xFF1E293B),
            selectedItemColor: Colors.blueAccent,
            unselectedItemColor: Colors.grey,
            type: BottomNavigationBarType.fixed,
            selectedFontSize: 11,
            unselectedFontSize: 11,
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.timer_outlined, size: 20), label: "Timer"),
              BottomNavigationBarItem(icon: Icon(Icons.vaccines_outlined, size: 20), label: "Drugs"),
              BottomNavigationBarItem(icon: Icon(Icons.alt_route, size: 20), label: "Pathway"),
              BottomNavigationBarItem(icon: Icon(Icons.notes, size: 20), label: "Journal"),
              BottomNavigationBarItem(icon: Icon(Icons.draw, size: 20), label: "Certify"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatBadge({required IconData icon, required String label, required String value, required Color color}) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
        ),
      ],
    );
  }

  Widget _buildEpiNotificationBanner(BuildContext context, AclsState state, AclsStateManager stateManager) {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.blueAccent.withOpacity(0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.blueAccent.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Expanded(
            child: Row(
              children: [
                Icon(Icons.notifications_active, color: Colors.blueAccent, size: 20, semanticLabel: "Epi Notification"),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        "EPINEPHRINE IS DUE NOW",
                        style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                      SizedBox(height: 2),
                      Text(
                        "Administer 1mg Epinephrine IV/IO",
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: stateManager.pushEpinephrine,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blueAccent,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            child: const Text("Push Drug", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
          ),
        ],
      ),
    );
  }

  Widget _buildRhythmCheckBanner(BuildContext context, AclsState state, AclsStateManager stateManager) {
    final isCritical = state.rhythmCheckTimeLeft == 0;
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isCritical ? Colors.red.shade900.withOpacity(0.2) : Colors.amber.shade900.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isCritical ? Colors.redAccent : Colors.amberAccent.withOpacity(0.4)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.warning, color: isCritical ? Colors.redAccent : Colors.amberAccent, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    "PAUSE FOR RHYTHM CHECK",
                    style: TextStyle(
                      color: isCritical ? Colors.redAccent : Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              Text(
                state.rhythmCheckTimeLeft > 0 ? "${state.rhythmCheckTimeLeft}s" : "[ ! OVERTIME ! ]",
                style: TextStyle(
                  color: isCritical ? Colors.redAccent : Colors.tealAccent,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            "Determine rhythm immediately on monitor:",
            style: TextStyle(color: Colors.grey, fontSize: 11),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => stateManager.setRhythmDecision(PatientRhythm.shockable),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.redAccent,
                    side: const BorderSide(color: Colors.redAccent),
                  ),
                  child: const Text("SHOCKABLE (VF/pVT)", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => stateManager.setRhythmDecision(PatientRhythm.nonShockable),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.blueAccent,
                    side: const BorderSide(color: Colors.blueAccent),
                  ),
                  child: const Text("NON-SHOCKABLE", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildShockAdvisedBanner(BuildContext context, AclsState state, AclsStateManager stateManager) {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.redAccent.withOpacity(0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.redAccent),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              const Icon(Icons.flash_on, color: Colors.redAccent, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "⚡ SHOCK ADVISED (VF/pVT)",
                      style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "Charge defibrillator to ${state.selectedEnergy}J immediately",
                      style: const TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () => stateManager.completeRhythmAdvised(false),
                  child: const Text("Rhythm Changed", style: TextStyle(color: Colors.grey, fontSize: 11)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: stateManager.shockPatient,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text("DELIVER SHOCK NOW", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEpiAdvisedBanner(BuildContext context, AclsState state, AclsStateManager stateManager) {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.green.shade900.withOpacity(0.2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.greenAccent),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.science, color: Colors.greenAccent, size: 18),
              SizedBox(width: 8),
              Text(
                "Epinephrine Advised (Asystole / PEA)",
                style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            "Administer Epinephrine 1mg IV/IO ASAP and resume CPR cycle.",
            style: TextStyle(color: Colors.grey, fontSize: 11),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => stateManager.completeRhythmAdvised(false),
                child: const Text("Acknowledge", style: TextStyle(color: Colors.grey, fontSize: 11)),
              ),
              const SizedBox(width: 10),
              ElevatedButton(
                onPressed: stateManager.pushEpinephrine,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.teal,
                  foregroundColor: Colors.white,
                ),
                child: const Text("Administer Epinephrine", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _renderActiveTab(AclsState state, AclsStateManager stateManager) {
    switch (_activeTab) {
      case 0:
        return _renderTimerTab(state, stateManager);
      case 1:
        return _renderDrugsTab(state, stateManager);
      case 2:
        return _renderPathwayTab(state, stateManager);
      case 3:
        return _renderJournalTab(state, stateManager);
      case 4:
        return _renderCertifyTab(state, stateManager);
      default:
        return _renderTimerTab(state, stateManager);
    }
  }

  Widget _renderTimerTab(AclsState state, AclsStateManager stateManager) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Circular Timer View for CPR
          Center(
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 180,
                  height: 180,
                  child: CircularProgressIndicator(
                    value: state.cprTimeLeft / AclsConstants.cprCycleDuration,
                    strokeWidth: 8,
                    backgroundColor: const Color(0xFF1E293B),
                    color: state.cprTimeLeft < 15 ? Colors.redAccent : Colors.tealAccent,
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text("CPR TIMER LEFT", style: TextStyle(color: Colors.grey, fontSize: 10, letterSpacing: 0.5)),
                    const SizedBox(height: 4),
                    Text(
                      _formatTime(state.cprTimeLeft),
                      style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      state.isTimerRunning ? "METRONOME ACTIVE" : "PAUSED",
                      style: TextStyle(
                        color: state.isTimerRunning ? Colors.tealAccent : Colors.amberAccent,
                        fontSize: 9,
                        letterSpacing: 0.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Core Timing Controls
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: stateManager.togglePause,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: state.isTimerRunning ? Colors.amber.shade700 : Colors.teal.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: Icon(state.isTimerRunning ? Icons.pause : Icons.play_arrow),
                  label: Text(state.isTimerRunning ? "PAUSE METRONOME" : "RESUME METRONOME", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: stateManager.recordRosc,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: const Icon(Icons.celebration),
                  label: const Text("ROSC ACHIEVED", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Epinephrine Countdown Card
          _buildEpinephrineCard(state),

          const SizedBox(height: 24),

          // Reversible Causes H's and T's diagnostics
          _buildHsAndTsCard(state, stateManager),
        ],
      ),
    );
  }

  Widget _buildEpinephrineCard(AclsState state) {
    final double epiProgress = state.epiTimeLeft / AclsConstants.epiInterval;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.amberAccent.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.science_outlined, color: Colors.amberAccent, size: 16),
                  SizedBox(width: 6),
                  Text("EPINEPHRINE TIMELINE", style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                ],
              ),
              Text(
                _formatTime(state.epiTimeLeft),
                style: const TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'monospace'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          LinearProgressIndicator(
            value: epiProgress,
            backgroundColor: Colors.black12,
            color: Colors.amberAccent,
            minHeight: 6,
          ),
          const SizedBox(height: 8),
          const Text(
            "Recommended Dose: 1mg IV/IO every 3-5 minutes (180s cycle).",
            style: TextStyle(color: Colors.grey, fontSize: 10),
          ),
        ],
      ),
    );
  }

  Widget _buildHsAndTsCard(AclsState state, AclsStateManager stateManager) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: state.showHsAndTs,
          onExpansionChanged: (val) => stateManager.toggleHsAndTs(),
          leading: const Icon(Icons.help_outline, color: Colors.blueAccent),
          title: const Text(
            "REVERSIBLE CAUSES (H's & T's)",
            style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
          ),
          subtitle: const Text("Diagnostic checklists for underlying causes", style: TextStyle(color: Colors.grey, fontSize: 10)),
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 14, right: 14, bottom: 14),
              child: ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: AclsConstants.hAndTs.length,
                itemBuilder: (context, idx) {
                  final cause = AclsConstants.hAndTs[idx];
                  return CheckboxListTile(
                    value: _checkedCauses[idx],
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(cause.term, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                    subtitle: Text(cause.description, style: const TextStyle(color: Colors.grey, fontSize: 10)),
                    onChanged: (val) {
                      setState(() {
                        _checkedCauses[idx] = val!;
                      });
                    },
                  );
                },
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _renderDrugsTab(AclsState state, AclsStateManager stateManager) {
    return ListView(
      children: [
        const Text(
          "ACLS REGISTERED INTERVENTIONS",
          style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.0),
        ),
        const SizedBox(height: 14),

        _buildDrugItem(
          title: "Epinephrine (1mg)",
          description: "Vasopressor. Given every 3-5 min. Promotes coronary perfusion.",
          dosageStr: "1mg IV/IO bolus + 20ml saline flush",
          onPressed: stateManager.pushEpinephrine,
          color: Colors.blueAccent,
        ),
        const SizedBox(height: 14),

        _buildDrugItem(
          title: "Amiodarone (300mg / 150mg)",
          description: "Antiarrhythmic. Given in shockable rhythm after 3rd and 5th shocks.",
          dosageStr: "Choose 300mg First Dose or 150mg Dose",
          onPressed: () => stateManager.pushAmiodarone("300mg"),
          color: Colors.purpleAccent,
          secondaryAction: () => stateManager.pushAmiodarone("150mg"),
          secondaryLabel: "Push 150mg",
        ),
        const SizedBox(height: 14),

        _buildDrugItem(
          title: "Lidocaine (1-1.5 mg/kg)",
          description: "Antiarrhythmic. Alternative to Amiodarone for persistent shockable VF.",
          dosageStr: "Initial Dose 1-1.5mg/kg, Maintenance 0.5-0.75mg/kg",
          onPressed: () => stateManager.pushLidocaine("100mg"),
          color: Colors.tealAccent,
        ),
        const SizedBox(height: 14),

        // Advanced Airway section
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("ADVANCED AIRWAY PLACEMENT", style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                  SizedBox(height: 2),
                  Text("Record endotracheal tube / LMA placement", style: TextStyle(color: Colors.grey, fontSize: 10)),
                ],
              ),
              ElevatedButton(
                onPressed: () {
                  stateManager.addLog(EventType.advancedAirway, "🎙️ Advanced airway placed successfully - waveform capnography connected.");
                },
                style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo),
                child: const Text("Record Tube", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDrugItem({
    required String title,
    required String description,
    required String dosageStr,
    required VoidCallback onPressed,
    required Color color,
    VoidCallback? secondaryAction,
    String? secondaryLabel,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
                child: Text("ACTIVE TIMINGS", style: TextStyle(color: color, fontSize: 8, fontWeight: FontWeight.bold)),
              )
            ],
          ),
          const SizedBox(height: 6),
          Text(description, style: const TextStyle(color: Colors.grey, fontSize: 10)),
          const SizedBox(height: 8),
          Text("Suggested dose: $dosageStr", style: const TextStyle(color: Colors.amberAccent, fontSize: 9, fontFamily: 'monospace')),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (secondaryAction != null) ...[
                OutlinedButton(
                  onPressed: secondaryAction,
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.grey)),
                  child: Text(secondaryLabel ?? "Push secondary", style: const TextStyle(fontSize: 10)),
                ),
                const SizedBox(width: 10),
              ],
              ElevatedButton(
                onPressed: onPressed,
                style: ElevatedButton.styleFrom(backgroundColor: color, foregroundColor: Colors.black),
                child: const Text("Push & Log Dose", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _renderPathwayTab(AclsState state, AclsStateManager stateManager) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          "ACLS CLINICAL DECISION FLOWCHART",
          style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.blueAccent.withOpacity(0.15)),
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFlowStep("1", "ACLS CPR initiated. Attach defibrillator / monitor and evaluate rhythm."),
                  _buildFlowConnection(),
                  _buildFlowDecisionBranch(
                    title: "Rhythm Shockability Check?",
                    shockableStep: "VF / pVT Path (Shockable)\n1. Deliver shock immediately\n2. Resume 2 min CPR immediately\n3. Push Epinephrine after 3 min\n4. Amiodarone after 3rd shock",
                    nonShockableStep: "Asystole / PEA Path (Non-Shockable)\n1. Resume 2 min CPR immediately\n2. Administer Epinephrine ASAP\n3. Push Epi every 3-5 min\n4. Investigate H's and T's",
                  ),
                  _buildFlowConnection(),
                  _buildFlowStep("4", "Advanced Airway consideration: Waveform capnography, 30:2 or continuous ventilation at 1 breath every 6s."),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFlowStep(String num, String text) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.blueAccent.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 10,
            backgroundColor: Colors.blueAccent,
            child: Text(num, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 11))),
        ],
      ),
    );
  }

  Widget _buildFlowConnection() {
    return const Center(child: Icon(Icons.arrow_downward, color: Colors.blueAccent, size: 18));
  }

  Widget _buildFlowDecisionBranch({required String title, required String shockableStep, required String nonShockableStep}) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 11)),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.redAccent.withOpacity(0.08), borderRadius: BorderRadius.circular(6)),
                  child: Text(shockableStep, style: const TextStyle(color: Colors.grey, fontSize: 10)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.greenAccent.withOpacity(0.08), borderRadius: BorderRadius.circular(6)),
                  child: Text(nonShockableStep, style: const TextStyle(color: Colors.grey, fontSize: 10)),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _renderJournalTab(AclsState state, AclsStateManager stateManager) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          "PROCEDURAL CHRONOLOGY REALTIME JOURNAL",
          style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.8),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: state.logs.isEmpty
              ? const Center(child: Text("No actions logged yet", style: TextStyle(color: Colors.grey)))
              : ListView.builder(
                  itemCount: state.logs.length,
                  itemBuilder: (context, idx) {
                    final log = state.logs[idx];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.blueAccent.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(log.type.name.toUpperCase(), style: const TextStyle(color: Colors.blueAccent, fontSize: 8, fontWeight: FontWeight.bold)),
                              ),
                              Text(
                                "${log.timestamp.hour.toString().padLeft(2, '0')}:${log.timestamp.minute.toString().padLeft(2, '0')}:${log.timestamp.second.toString().padLeft(2, '0')}",
                                style: const TextStyle(color: Colors.grey, fontSize: 10, fontFamily: 'monospace'),
                              )
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(log.description, style: const TextStyle(color: Colors.white, fontSize: 11)),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _renderCertifyTab(AclsState state, AclsStateManager stateManager) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          "CLINICAL CERTIFICATION & ARCHIVING",
          style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
        ),
        const SizedBox(height: 6),
        const Text(
          "Review active timelines. Sign physically inside canvas pad to transmit validated logs into the Nepal Resuscitation Registry secure storage.",
          style: TextStyle(color: Colors.grey, fontSize: 10),
        ),
        const SizedBox(height: 14),

        // Timeline Summary stats summary
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            children: [
              _buildCertSummaryRow("Total Timeline Duration", _formatTime(state.totalTime)),
              _buildCertSummaryRow("Defibrillation Shocks Given", "${state.shocksCount}"),
              _buildCertSummaryRow("Epinephrine 1mg Pushes", "${state.epiCount}"),
              _buildCertSummaryRow("Advanced Airway Status", state.hasAdvancedAirway ? "Secured" : "None Given"),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Signature Pad Drawing Canvas
        const Text("CLINICIAN SIGNATURE PAD", style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.withOpacity(0.3)),
            ),
            child: GestureDetector(
              onPanUpdate: (drag) {
                RenderBox? box = context.findRenderObject() as RenderBox?;
                Offset local = box!.globalToLocal(drag.globalPosition);
                setState(() {
                  _signaturePoints.add(local);
                  _isSigned = true;
                });
              },
              onPanEnd: (drag) {
                // Terminate stroke
                setState(() {
                  _signaturePoints.add(Offset.infinite);
                });
              },
              child: CustomPaint(
                painter: _SignaturePainter(points: _signaturePoints),
                child: _isSigned 
                    ? null 
                    : const Center(
                        child: Text("Draw your Signature here to Certify logs", style: TextStyle(color: Colors.grey, fontSize: 11)),
                      ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 12),

        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: () {
                setState(() {
                  _signaturePoints.clear();
                  _isSigned = false;
                });
              },
              child: const Text("Clear Pad", style: TextStyle(color: Colors.redAccent, fontSize: 12)),
            ),
            ElevatedButton(
              onPressed: _isSigned 
                  ? () {
                      stateManager.addLog(EventType.info, "📝 Timeline verified and signed off by certified clinician.");
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("ACLS Timeline successfully certified & synchronized!")),
                      );
                    }
                  : null,
              style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
              child: const Text("TRANSMIT REGISTRY RECORD", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCertSummaryRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11)),
          Text(val, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11, fontFamily: 'monospace')),
        ],
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<Offset> points;

  _SignaturePainter({required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.blueAccent
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2.0;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != Offset.infinite && points[i + 1] != Offset.infinite) {
        // Draw segment
        canvas.drawLine(points[i], points[i + 1], paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
