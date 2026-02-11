# AI-Based Black-Box Problem Reconstruction System

## Executive Summary

This document describes a system that performs **reverse engineering of competitive programming problems from compiled executables**. Given a black-box `.exe` file, the system automatically infers:

1. **The problem statement** it solves
2. **Input/output specifications**
3. **The underlying algorithm**
4. **Clean C++ source code** that solves the problem

The system achieves this through **behavioral observation** combined with **LLM-powered reasoning**, without access to source code or internal logic.

---

## 1. Project Objective

### 1.1 What We're Building

A three-component system that treats a compiled C++ executable as a **black box** and reconstructs:

- **Problem Definition**: Full competitive programming problem statement
- **Constraints**: Input ranges, data types, and edge cases
- **Solution**: Clean, readable C++ implementation
- **Reasoning**: How the algorithm works

### 1.2 Core Innovation

This is **behavioral program synthesis through observational inference**:

```
Compiled .exe → Test Cases → Execution → I/O Pairs → LLM Reasoning → Problem Reconstruction
```

The system never sees:
- Source code
- Algorithm name
- Internal variables
- Comments or documentation

It only observes:
- **Input → Output behavior**
- Patterns across multiple test cases

---

## 2. Why This Is Challenging

### 2.1 The Fundamental Problem

**Under-determination**: Multiple different problems can produce identical input-output behavior.

**Example Ambiguity:**
```
Input: 5\n1 2 3 4 5
Output: 15

Could be:
- Sum of array elements
- Product of array length and middle element
- Sum of indices * values where value is odd
- 5th Fibonacci number
- etc.
```

### 2.2 Solution: Information-Rich Test Cases

Generate **strategically diverse** test cases to:
- Eliminate false hypotheses
- Reveal hidden patterns
- Expose edge case behavior
- Distinguish between similar algorithms

---

## 3. System Architecture

### 3.1 Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                  │
│  - User uploads .exe file                                │
│  - Provides input format specification                   │
│  - Provides constraints (ranges, data types)             │
│  - Displays reconstructed problem & solution             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Node.js + Express)                 │
│  - Secure .exe execution in Docker sandbox               │
│  - Test case generation orchestration                    │
│  - Gemini API integration                                │
│  - Multi-stage reasoning pipeline                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              LLM (Gemini 2.5 Flash)                      │
│  - Generate intelligent test cases                       │
│  - Infer problem from I/O behavior                       │
│  - Generate problem statement                            │
│  - Produce clean C++ solution                            │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

#### **Frontend (Next.js)**
- File upload interface for `.exe` files
- Input format specification form
- Constraint specification (ranges, types, structural hints)
- Real-time progress display
- Result presentation (problem + solution)

#### **Backend (Node.js + Express)**
- **Sandbox Management**: Spawn isolated Docker containers
- **Execution Engine**: Run `.exe` with timeout/memory limits
- **Test Case Orchestration**: Generate → Execute → Collect
- **LLM Integration**: Construct prompts, manage API calls
- **Pipeline Coordination**: Stage 1 → Stage 2 → Stage 3

#### **LLM (Gemini 2.5 Flash)**
- **Stage 1**: Generate information-rich test cases
- **Stage 3**: Infer problem from behavioral patterns
- **Output**: Structured problem statement + solution code

---

## 4. The Three-Stage Pipeline

### Stage 1: Intelligent Test Case Generation

#### Input to LLM

Provide the LLM with:

```json
{
  "inputFormat": "First line: integer n\nSecond line: n space-separated integers",
  "constraints": {
    "n": "1 ≤ n ≤ 100000",
    "elements": "-1000000000 ≤ a[i] ≤ 1000000000"
  },
  "dataTypes": {
    "n": "integer",
    "a": "array of integers"
  },
  "structuralHints": "Array-based problem with single output value"
}
```

#### LLM Task: Strategic Test Case Design

The LLM must generate **15-30 diverse test cases** covering:

1. **Minimal Cases**
   - `n = 1` (single element)
   - Smallest valid input

2. **Maximal Cases**
   - `n = 100000` (largest size)
   - Maximum value elements

3. **Edge Cases**
   - All zeros: `0 0 0 0 0`
   - All negative: `-5 -10 -3 -1`
   - All positive: `1 2 3 4 5`
   - Mixed signs: `-2 -1 0 1 2`

4. **Boundary Values**
   - `-1000000000` (min constraint)
   - `1000000000` (max constraint)
   - Values near zero

5. **Structural Patterns**
   - Sorted ascending: `1 2 3 4 5`
   - Sorted descending: `5 4 3 2 1`
   - All same: `7 7 7 7 7`
   - Alternating: `1 -1 1 -1 1`

6. **Mathematical Patterns**
   - Arithmetic sequence: `2 4 6 8 10`
   - Geometric sequence: `1 2 4 8 16`
   - Prime numbers: `2 3 5 7 11`
   - Fibonacci-like: `1 1 2 3 5`

7. **Random/Chaotic**
   - Unstructured random values
   - No discernible pattern

#### Example Output from LLM

```json
[
  {
    "input": "1\n42\n",
    "rationale": "Minimal case - single element"
  },
  {
    "input": "5\n1 2 3 4 5\n",
    "rationale": "Small sorted ascending sequence"
  },
  {
    "input": "5\n5 4 3 2 1\n",
    "rationale": "Small sorted descending sequence"
  },
  {
    "input": "6\n-3 -1 0 1 2 5\n",
    "rationale": "Mixed positive and negative with zero"
  },
  {
    "input": "4\n7 7 7 7\n",
    "rationale": "All elements identical"
  },
  {
    "input": "8\n-1000000000 -999999999 0 1 999999999 1000000000 100 -100\n",
    "rationale": "Boundary values and extremes"
  }
  // ... 10-25 more test cases
]
```

#### Why This Matters

Different test cases reveal different algorithmic behaviors:

- **Sum algorithm**: Output scales linearly with element values
- **Max algorithm**: Only affected by largest element
- **Sorting algorithm**: Output shows sorted order
- **DP algorithm**: Exhibits optimal substructure patterns
- **Greedy algorithm**: Local optimal choices visible

**More diverse tests = Better discrimination between hypotheses**

---

### Stage 2: Controlled Execution

#### Execution Environment

**Docker Container Configuration:**
```dockerfile
FROM alpine:latest
RUN apk add --no-cache wine gcc g++
WORKDIR /sandbox
COPY executable.exe .
# No network, no file system access
CMD timeout 5s wine executable.exe < input.txt > output.txt
```

#### Security Hardening

```javascript
// Backend execution wrapper
const executionConfig = {
  timeout: 5000,        // 5 second max
  memory: '256MB',      // Limited RAM
  cpuQuota: 50000,      // 50% CPU
  noNetwork: true,      // Isolated
  readOnly: true,       // Immutable filesystem
  killAfter: true       // Destroy container post-execution
};
```

#### Execution Loop

For each test case:

```javascript
async function executeTestCase(exe, testInput) {
  const container = await docker.createContainer({
    Image: 'sandbox:latest',
    Cmd: ['/bin/sh', '-c', `echo "${testInput}" | timeout 5s ./program.exe`],
    HostConfig: {
      Memory: 256 * 1024 * 1024,
      NetworkMode: 'none',
      ReadonlyRootfs: true
    }
  });
  
  await container.start();
  const output = await container.logs({ stdout: true });
  await container.remove({ force: true });
  
  return output.trim();
}
```

#### Output Collection

The system produces:

```json
[
  {
    "input": "5\n1 2 3 4 5\n",
    "output": "15"
  },
  {
    "input": "1\n42\n",
    "output": "42"
  },
  {
    "input": "4\n7 7 7 7\n",
    "output": "28"
  },
  {
    "input": "3\n-1 0 1\n",
    "output": "0"
  }
  // ... 15-30 pairs total
]
```

#### Critical Safety Checks

1. **Timeout Enforcement**: Kill process after 5 seconds
2. **Memory Limits**: Prevent memory bombs
3. **No Network**: Block all external communication
4. **No File Access**: Read-only filesystem
5. **Process Isolation**: Each execution in fresh container
6. **Container Destruction**: Remove all traces post-execution
7. **Input Sanitization**: Validate all inputs before execution

**Assumption**: The executable is potentially malicious.

---

### Stage 3: Behavioral Inference

#### Input to LLM

Now we provide the complete observational dataset:

```json
{
  "inputFormat": "First line: integer n\nSecond line: n integers",
  "constraints": {
    "n": "1 ≤ n ≤ 100000",
    "elements": "-1000000000 ≤ a[i] ≤ 1000000000"
  },
  "observations": [
    {"input": "5\n1 2 3 4 5\n", "output": "15"},
    {"input": "1\n42\n", "output": "42"},
    {"input": "4\n7 7 7 7\n", "output": "28"},
    {"input": "3\n-1 0 1\n", "output": "0"},
    {"input": "6\n-10 -5 0 5 10 15\n", "output": "15"},
    {"input": "2\n1000000000 1000000000\n", "output": "2000000000"},
    // ... 10-25 more observations
  ],
  "task": "Infer the competitive programming problem this program solves"
}
```

#### LLM Reasoning Process

The LLM must:

1. **Pattern Recognition**
   - Observe: `[1,2,3,4,5] → 15`, `[7,7,7,7] → 28`, `[-1,0,1] → 0`
   - Hypothesis: Output = sum of all elements

2. **Hypothesis Validation**
   - Check against ALL observations
   - `1+2+3+4+5 = 15` ✓
   - `7+7+7+7 = 28` ✓
   - `-1+0+1 = 0` ✓
   - `1000000000 + 1000000000 = 2000000000` ✓

3. **Eliminate Alternatives**
   - Not max element (would be `5` not `15`)
   - Not product (would be `120` not `15`)
   - Not average (would be `3` not `15`)
   - Not count (would be `5` not `15`)

4. **Confirm Pattern Consistency**
   - Test hypothesis against edge cases
   - Verify with sorted/unsorted/negative inputs
   - Check boundary conditions

#### What the LLM Must Detect

The model should recognize common algorithmic patterns:

| Pattern Type | Example Behavior | Detection Clues |
|--------------|------------------|-----------------|
| **Aggregation** | Sum, product, min, max | Output depends on all/specific elements |
| **Sorting** | Sorted order output | Position changes affect output |
| **Search** | Binary search, linear search | Presence/absence affects output |
| **DP** | Optimal substructure | Subarray patterns reveal recurrence |
| **Greedy** | Local optimal choices | Sequential decision patterns |
| **Graph** | BFS/DFS traversal | Connectivity affects output |
| **Math** | GCD, LCM, prime factorization | Number-theoretic relationships |
| **String** | Palindrome, substring | Character-level dependencies |
| **Bit Manipulation** | XOR, AND, OR | Bitwise patterns in output |

#### Expected Output Structure

```markdown
# Problem: Array Sum

## Problem Statement
Given an array of n integers, calculate the sum of all elements.

## Input Format
- First line: integer n (1 ≤ n ≤ 100000)
- Second line: n space-separated integers a[i] (-10^9 ≤ a[i] ≤ 10^9)

## Output Format
Print a single integer: the sum of all array elements.

## Constraints
- 1 ≤ n ≤ 100000
- -10^9 ≤ a[i] ≤ 10^9
- Answer fits in 64-bit signed integer

## Sample Test Cases

### Input
```
5
1 2 3 4 5
```

### Output
```
15
```

### Explanation
1 + 2 + 3 + 4 + 5 = 15

## Solution Code

```cpp
#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;
    
    vector<int> arr(n);
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    
    long long sum = 0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
    }
    
    cout << sum << endl;
    
    return 0;
}
```

## Algorithm Explanation
1. Read the array size n
2. Read n integers into an array
3. Initialize sum = 0
4. Iterate through all elements, adding each to sum
5. Output the final sum

**Time Complexity**: O(n)  
**Space Complexity**: O(n)
```

---

## 5. Key Technical Considerations

### 5.1 Determinism Requirement

**The system assumes the executable is deterministic:**

✅ **Supported:**
- Pure functions (input → output)
- Mathematical computations
- Sorting algorithms
- Dynamic programming
- Graph algorithms (with deterministic traversal)

❌ **Not Supported:**
- Random number generation
- Time-based logic
- External API calls
- File system operations
- Non-deterministic algorithms

**Why**: Non-deterministic programs produce different outputs for identical inputs, making pattern inference impossible.

### 5.2 Input/Output Assumptions

**Standard competitive programming constraints:**

```
Input Source: stdin (standard input)
Output Destination: stdout (standard output)
No user interaction required
No file I/O
Single execution produces complete output
```

### 5.3 Observable vs Hidden Complexity

#### Observable Behaviors

These can be inferred from I/O:
- **Aggregation operations** (sum, max, min)
- **Sorting** (output order changes)
- **Search** (found/not found decisions)
- **Mathematical transforms** (GCD, modulo, factorization)
- **Basic DP** (optimal value computed)

#### Hidden Complexity

These are harder to detect:
- **Algorithm choice** (QuickSort vs MergeSort if both produce sorted output)
- **Internal state** (DP table structure)
- **Optimization tricks** (coordinate compression, binary lifting)
- **Implementation details** (iterative vs recursive)

**The LLM must infer the PROBLEM, not necessarily the exact algorithm.**

### 5.4 Collision Scenarios

**Problem**: Different problems can produce identical I/O behavior.

**Example:**

```
Input: 5\n1 2 3 4 5
Output: 3

Could be:
1. Median of array → 3
2. Middle element → 3
3. Mode of array → 3
4. Third element → 3
5. Ceiling(average) → 3
```

**Solution**: Generate test cases that **break these collisions**:

```
Input: 6\n1 2 3 4 5 6
Output: ?

- Median: 3.5 → depends on rounding
- Middle element: undefined (even length)
- Third element: 3
```

By observing behavior on **even-length arrays**, we can distinguish hypotheses.

---

## 6. Security Architecture

### 6.1 Threat Model

**Assume the uploaded .exe is malicious and attempts to:**
- Execute arbitrary code
- Access host filesystem
- Make network requests
- Consume infinite resources
- Privilege escalation
- Container breakout

### 6.2 Defense Layers

#### Layer 1: Containerization
```yaml
Docker Configuration:
  - Image: Minimal Alpine Linux
  - Network: Disabled (--network=none)
  - Filesystem: Read-only
  - User: Non-root
  - Capabilities: Dropped
```

#### Layer 2: Resource Limits
```yaml
Resource Constraints:
  - CPU: 50% of single core
  - Memory: 256 MB
  - Disk I/O: Minimal
  - Process count: 1
  - Execution time: 5 seconds max
```

#### Layer 3: Syscall Filtering
```yaml
Seccomp Profile:
  - Allow: read, write, exit
  - Deny: network, file creation, fork, exec
```

#### Layer 4: Runtime Monitoring
```javascript
const monitor = {
  checkCPU: () => { /* kill if >50% */ },
  checkMemory: () => { /* kill if >256MB */ },
  checkTimeout: () => { /* kill after 5s */ },
  checkNetwork: () => { /* should never trigger */ }
};
```

#### Layer 5: Post-Execution Cleanup
```javascript
async function cleanup(containerId) {
  await container.stop({ t: 0 });
  await container.remove({ force: true, v: true });
  await removeVolumes(containerId);
  await clearLogs(containerId);
}
```

### 6.3 Input Sanitization

Before execution:
```javascript
function validateInput(input) {
  // Check size limits
  if (input.length > 10 * 1024 * 1024) throw new Error('Input too large');
  
  // No shell injection attempts
  if (input.includes('$(') || input.includes('`')) throw new Error('Invalid characters');
  
  // Must match expected format
  if (!matchesFormat(input, expectedFormat)) throw new Error('Format mismatch');
  
  return sanitize(input);
}
```

---

## 7. Limitations and Failure Modes

### 7.1 When The System WILL Fail

❌ **Non-Deterministic Programs**
```cpp
// Uses random - impossible to infer
int main() {
    srand(time(0));
    cout << rand() % 100;
}
```

❌ **Interactive Programs**
```cpp
// Requires back-and-forth - not supported
int main() {
    cout << "Enter guess: ";
    int guess;
    cin >> guess;
    cout << "Too high or too low? ";
    // ...
}
```

❌ **File-Based I/O**
```cpp
// Requires file system - blocked by sandbox
int main() {
    ifstream file("input.txt");
    // ...
}
```

❌ **Floating-Point Precision Dependent**
```cpp
// Small rounding differences break inference
double result = complexCalculation(); // 3.14159265358979323846...
cout << fixed << setprecision(15) << result;
```

❌ **Cryptographic/Hash Functions**
```cpp
// Output appears random without knowing algorithm
int main() {
    string s;
    cin >> s;
    cout << sha256(s); // Impossible to reverse-engineer
}
```

### 7.2 When The System MAY Struggle

⚠️ **Complex State Machines**
- Multiple phases of computation
- Hidden intermediate steps
- Non-obvious state transitions

⚠️ **Highly Optimized Code**
- Coordinate compression
- Lazy propagation
- Obscure mathematical tricks

⚠️ **Ambiguous Problems**
- Multiple valid interpretations
- Insufficient test case diversity
- Under-constrained specifications

⚠️ **Very Large Output**
- Outputs that are arrays/matrices
- Multiple lines of structured data
- Difficult to pattern match

### 7.3 When The System WILL Succeed

✅ **Standard Competitive Programming Problems**
- Sum/product of array
- Sorting variations
- Searching (binary, linear)
- Basic graph algorithms (BFS, DFS)
- Simple DP (knapsack, LIS, LCS)
- Mathematical computations (GCD, factorial, primes)
- String processing (palindrome, substring)

✅ **Deterministic Algorithms**
- Same input always produces same output
- No randomness, no time dependency
- Pure mathematical/logical transformations

✅ **Clear Input/Output Patterns**
- Single integer output
- Simple formatted output
- Consistent formatting

---

## 8. Prompt Engineering Strategy

### 8.1 Stage 1 Prompt (Test Case Generation)

```
You are an expert competitive programmer designing test cases.

Given:
- Input format: {inputFormat}
- Constraints: {constraints}
- Data types: {dataTypes}

Generate 25 diverse test cases that maximize behavioral observability.

Your test cases must cover:
1. Minimum/maximum constraints
2. Edge cases (zeros, negatives, boundaries)
3. Sorted/reverse-sorted sequences
4. All-same elements
5. Arithmetic/geometric patterns
6. Random/chaotic inputs
7. Pathological cases specific to common algorithms

Output format: JSON array of {input, rationale}

Goal: Create tests that distinguish between different algorithmic approaches.
```

### 8.2 Stage 3 Prompt (Problem Inference)

```
You are an expert competitive programmer analyzing black-box program behavior.

Given:
- Input format: {inputFormat}
- Constraints: {constraints}
- 25 input-output observations: {observations}

Task: Infer the competitive programming problem this program solves.

Step 1: Identify patterns
- What mathematical relationship exists between inputs and outputs?
- Test multiple hypotheses (sum? max? sort? DP?)

Step 2: Validate hypothesis
- Check against ALL observations
- Look for counterexamples

Step 3: Generate problem statement
- Title
- Clear problem description
- Input/output format
- Constraints
- Sample test case with explanation

Step 4: Provide clean C++ solution
- Readable, well-commented code
- Time/space complexity analysis

Output: Structured markdown with problem + solution
```

---

## 9. Success Metrics

### 9.1 System Performance Indicators

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Inference Accuracy** | >85% | Correct problem identified |
| **Execution Safety** | 100% | No container escapes |
| **Test Case Diversity** | >20 unique patterns | Shannon entropy |
| **Response Time** | <60 seconds | End-to-end pipeline |
| **LLM API Costs** | <$0.10/problem | Gemini Flash pricing |

### 9.2 Evaluation Dataset

To validate the system, test against:

1. **Simple Problems** (baseline)
   - Array sum
   - Maximum element
   - Sorting check

2. **Medium Problems**
   - Binary search
   - Two pointers
   - Prefix sums

3. **Complex Problems**
   - Dynamic programming
   - Graph traversal
   - Greedy algorithms

Expected accuracy: 95% simple, 80% medium, 60% complex

---

## 10. Implementation Roadmap

### Phase 1: MVP (Week 1-2)
- [ ] Frontend: File upload + format specification
- [ ] Backend: Basic Docker execution
- [ ] LLM: Simple test case generation
- [ ] LLM: Basic pattern inference (sum/max/min)

### Phase 2: Enhanced Inference (Week 3-4)
- [ ] Advanced test case generation (25+ diverse cases)
- [ ] Multi-hypothesis validation
- [ ] DP/Greedy pattern recognition
- [ ] Improved prompt engineering

### Phase 3: Production Hardening (Week 5-6)
- [ ] Complete security lockdown
- [ ] Resource limit enforcement
- [ ] Error handling & logging
- [ ] Performance optimization

### Phase 4: Evaluation (Week 7-8)
- [ ] Test on 100+ known problems
- [ ] Measure accuracy metrics
- [ ] Collect failure cases
- [ ] Refine prompts based on failures

---

## 11. Example End-to-End Flow

### User Input
```
Upload: fibonacci.exe
Input Format: "Single integer n"
Constraints: "1 ≤ n ≤ 30"
```

### Stage 1: Test Generation
```json
[
  {"input": "1"},
  {"input": "2"},
  {"input": "5"},
  {"input": "10"},
  {"input": "30"},
  {"input": "15"}
]
```

### Stage 2: Execution
```json
[
  {"input": "1", "output": "1"},
  {"input": "2", "output": "1"},
  {"input": "5", "output": "5"},
  {"input": "10", "output": "55"},
  {"input": "30", "output": "832040"},
  {"input": "15", "output": "610"}
]
```

### Stage 3: Inference

**LLM Reasoning:**
```
Observation: Output grows rapidly (exponential-like)
Hypothesis 1: n^2 → Fails (5^2 = 25, not 5)
Hypothesis 2: 2^n → Fails (2^5 = 32, not 5)
Hypothesis 3: Fibonacci → Matches all observations
  Fib(1) = 1 ✓
  Fib(2) = 1 ✓
  Fib(5) = 5 ✓
  Fib(10) = 55 ✓
```

**Final Output:**
```markdown
# Problem: Fibonacci Number

Given integer n, calculate the n-th Fibonacci number.

F(1) = 1, F(2) = 1
F(n) = F(n-1) + F(n-2) for n > 2

## Solution
```cpp
long long fib(int n) {
    if (n <= 2) return 1;
    long long a = 1, b = 1;
    for (int i = 3; i <= n; i++) {
        long long c = a + b;
        a = b;
        b = c;
    }
    return b;
}
```
```

---

## 12. Conclusion

This system demonstrates **behavioral program synthesis** - reconstructing high-level problem descriptions from low-level input-output observations. It combines:

- **Intelligent test design** (LLM-generated)
- **Safe execution** (Docker isolation)
- **Pattern recognition** (LLM inference)
- **Code generation** (LLM synthesis)

The key insight: With enough **strategically chosen test cases**, we can distinguish between competing hypotheses and accurately reconstruct the original problem.

**Limitations are real** - the system works best on deterministic, standard competitive programming problems. But within those constraints, it opens fascinating possibilities for automated program understanding.

---

## Appendix A: Sample Problems (Expected Success)

1. Array Sum
2. Maximum Element
3. Minimum Element
4. Array Sorting (check if sorted)
5. Binary Search (element exists)
6. GCD of two numbers
7. Factorial
8. Prime number check
9. Fibonacci sequence
10. Palindrome check
11. Longest Common Subsequence (simple cases)
12. Knapsack 0/1 (small instances)
13. Prefix sum queries
14. Majority element
15. Two sum problem

## Appendix B: Sample Problems (Expected Challenges)

1. Cryptographic hashing
2. Randomized algorithms
3. Monte Carlo simulations
4. Complex DP (matrix chain, TSP)
5. Advanced graph (max flow, bipartite matching)
6. Number theory (modular exponentiation)
7. Computational geometry
8. Segment trees
9. Heavy-light decomposition
10. FFT/NTT

---

**Document Version**: 1.0  
**Last Updated**: February 2026  
**Target Audience**: LLM Models (for understanding system architecture and implementation requirements)