const { performance } = require('perf_hooks');

// Generates a mock array of profiles
function generateMockProfiles(size) {
  const profiles = [];
  for (let i = 0; i < size; i++) {
    profiles.push({
      id: `doc-${i}`,
      fullName: `Dr. Doctor-${i}`,
      email: `doc-${i}@example.com`,
      councilRegistration: `NMC-${10000 + i}`,
      highestDegree: 'MBBS',
      kyc: {
        councilRegistration: `NMC-${10000 + i}`,
        degree: 'MBBS',
        specialty: 'General Practice',
        institution: 'Nepal Medical College',
        idCardNumber: `ID-${100000 + i}`,
        kycStatus: 'pending',
        submittedAt: Date.now()
      }
    });
  }
  return profiles;
}

function runBenchmark() {
  const sizes = [10, 100, 1000, 5000, 10000];
  const iterations = 1000;

  console.log('--- Establishing Baseline Lookup Performance ---');
  console.log(`Running ${iterations} random lookups per size...`);
  console.log('--------------------------------------------------');

  for (const size of sizes) {
    const profiles = generateMockProfiles(size);

    // Create lookups target IDs
    const targetIds = [];
    for (let i = 0; i < iterations; i++) {
      const randomIndex = Math.floor(Math.random() * size);
      targetIds.push(`doc-${randomIndex}`);
    }

    // 1. Array.find (Baseline)
    const startArray = performance.now();
    for (const id of targetIds) {
      const match = profiles.find(p => p.id === id);
    }
    const endArray = performance.now();
    const arrayTime = endArray - startArray;

    // 2. Map.get (Optimized)
    const startMapBuild = performance.now();
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    const endMapBuild = performance.now();
    const mapBuildTime = endMapBuild - startMapBuild;

    const startMapGet = performance.now();
    for (const id of targetIds) {
      const match = profilesMap.get(id);
    }
    const endMapGet = performance.now();
    const mapGetTime = endMapGet - startMapGet;

    const totalMapTime = mapBuildTime + mapGetTime;
    const speedup = arrayTime / totalMapTime;

    console.log(`Profile Array Size: ${size}`);
    console.log(`  Array.find Time:       ${arrayTime.toFixed(4)} ms`);
    console.log(`  Map Creation Time:     ${mapBuildTime.toFixed(4)} ms`);
    console.log(`  Map.get Lookup Time:   ${mapGetTime.toFixed(4)} ms`);
    console.log(`  Total Map Time:        ${totalMapTime.toFixed(4)} ms`);
    console.log(`  Speedup factor:        ${speedup.toFixed(2)}x`);
    console.log('--------------------------------------------------');
  }
}

runBenchmark();
