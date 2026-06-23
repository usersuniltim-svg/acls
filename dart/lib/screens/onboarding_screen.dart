import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/acls_state.dart';
import '../state/acls_state_manager.dart';
import 'landing_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _degreeController = TextEditingController();
  final _councilController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  
  Profession _selectedProfession = Profession.doctor;
  Sex _selectedSex = Sex.male;
  DateTime _dob = DateTime(1990, 1, 1);

  @override
  void dispose() {
    _nameController.dispose();
    _degreeController.dispose();
    _councilController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _dob,
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
      theme: ThemeData.dark(),
    );
    if (picked != null && picked != _dob) {
      setState(() {
        _dob = picked;
      });
    }
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      final profile = UserProfile(
        fullName: _nameController.text.trim(),
        profession: _selectedProfession,
        highestDegree: _degreeController.text.trim(),
        dob: "${_dob.year}-${_dob.month.toString().padLeft(2, '0')}-${_dob.day.toString().padLeft(2, '0')}",
        sex: _selectedSex,
        councilRegistration: _councilController.text.trim(),
        email: _emailController.text.trim(),
        phone: _phoneController.text.trim(),
        onboardedAt: DateTime.now(),
      );

      context.read<AclsStateManager>().setUserProfile(profile);

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LandingScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        title: const Text(
          "Practitioner Registry",
          style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
        ),
        backgroundColor: const Color(0xFF1E293B), // Slate 800
        elevation: 0,
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Nepal Resuscitation Registry badge
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: Colors.redAccent,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.health_and_safety, color: Colors.white, size: 28),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "NEPAL RESUSCITATION REGISTRY",
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                letterSpacing: 0.8,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              "Certified ACLS Clinical Companion System",
                              style: TextStyle(color: Colors.grey, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                
                const Text(
                  "CRITICAL CREDENTIALING VALIDATION",
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.grey,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 16),

                _buildTextField(
                  controller: _nameController,
                  label: "Clinician Full Name",
                  icon: Icons.person,
                  validator: (v) => v!.isEmpty ? "Name has to be provided" : null,
                ),
                const SizedBox(height: 16),

                DropdownButtonFormField<Profession>(
                  value: _selectedProfession,
                  dropdownColor: const Color(0xFF1E293B),
                  style: const TextStyle(color: Colors.white),
                  decoration: _getInputDecoration("Professional Category", Icons.badge),
                  items: Profession.values.map((prof) {
                    return DropdownMenuItem(
                      value: prof,
                      child: Text(prof.name.toUpperCase()),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedProfession = v!),
                ),
                const SizedBox(height: 16),

                _buildTextField(
                  controller: _degreeController,
                  label: "Highest Qualification / Degree",
                  icon: Icons.school,
                  validator: (v) => v!.isEmpty ? "Credential is requested" : null,
                ),
                const SizedBox(height: 16),

                _buildTextField(
                  controller: _councilController,
                  label: "Council Registration Number",
                  icon: Icons.verified_user,
                  helper: "e.g. Nepal Medical Council registration ID",
                  validator: (v) => v!.isEmpty ? "Registraiton ID is required for verification" : null,
                ),
                const SizedBox(height: 16),

                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => _selectDate(context),
                        child: InputDecorator(
                          decoration: _getInputDecoration("Date of Birth", Icons.calendar_today),
                          child: Text(
                            "${_dob.year}-${_dob.month.toString().padLeft(2, '0')}-${_dob.day.toString().padLeft(2, '0')}",
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<Sex>(
                        value: _selectedSex,
                        dropdownColor: const Color(0xFF1E293B),
                        style: const TextStyle(color: Colors.white),
                        decoration: _getInputDecoration("Sex Gender", Icons.people),
                        items: Sex.values.map((s) {
                          return DropdownMenuItem(
                            value: s,
                            child: Text(s.name.toUpperCase()),
                          );
                        }).toList(),
                        onChanged: (v) => setState(() => _selectedSex = v!),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                _buildTextField(
                  controller: _emailController,
                  label: "Official Email Address",
                  icon: Icons.email,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => !v!.contains('@') ? "Enter a valid email address" : null,
                ),
                const SizedBox(height: 16),

                _buildTextField(
                  controller: _phoneController,
                  label: "Phone Contact Number",
                  icon: Icons.phone,
                  keyboardType: TextInputType.phone,
                  validator: (v) => v!.length < 8 ? "Valid numeric phone contact is requested" : null,
                ),
                const SizedBox(height: 32),

                ElevatedButton(
                  onPressed: _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blueAccent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    elevation: 5,
                  ),
                  child: const Text(
                    "VALIDATE & ENTER CLINICAL SYSTEM",
                    style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.0, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? helper,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      validator: validator,
      style: const TextStyle(color: Colors.white),
      decoration: _getInputDecoration(label, icon).copyWith(
        helperText: helper,
        helperStyle: const TextStyle(color: Colors.grey, fontSize: 10),
      ),
    );
  }

  InputDecoration _getInputDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.grey),
      prefixIcon: Icon(icon, color: Colors.blueAccent),
      filled: true,
      fillColor: const Color(0xFF1E293B),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Colors.blueAccent, width: 1.5),
      ),
    );
  }
}
