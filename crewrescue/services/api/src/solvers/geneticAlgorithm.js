// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue AI — Genetic Algorithm Optimization Solver
//
// Algorithm:  Genetic Algorithm (GA)
// Complexity: O(popSize * generations * n) where n = work orders count
// Purpose:    Population-based evolutionary search for near-optimal schedules
//
// GA works by:
//   1. Initializing a population of diverse schedules (using greedy + random)
//   2. Evaluating each chromosome's fitness (inverse of schedule cost)
//   3. Selecting parents via tournament selection
//   4. Producing offspring via uniform crossover
//   5. Applying random mutation (swap/reassign)
//   6. Elitist replacement (best individual always survives)
// ─────────────────────────────────────────────────────────────────────────────

import { computeScheduleCost, isEligible } from './costFunction.js';
import { PINNED_STATUSES, SEVERITY } from '@crewrescue/shared';

// ── Chromosome representation ─────────────────────────────────────────────────
// A chromosome is a Map: workOrderId (string) → technicianId (string)

/**
 * Build a random feasible chromosome.
 * Falls back to the nearest eligible technician if random fails.
 */
function randomChromosome(workOrders, technicians) {
  const chromosome = new Map();
  for (const wo of workOrders) {
    if (PINNED_STATUSES.includes(wo.status)) continue;
    const eligible = technicians.filter((t) => isEligible(wo, t));
    if (eligible.length === 0) continue;
    chromosome.set(wo._id.toString(), eligible[Math.floor(Math.random() * eligible.length)]._id.toString());
  }
  return chromosome;
}

/**
 * Build a greedy chromosome (warm start, identical to SA's warm start).
 */
function greedyChromosome(workOrders, technicians) {
  const chromosome = new Map();
  const techLoad   = {};
  technicians.forEach((t) => { techLoad[t._id.toString()] = 0; });

  const sorted = workOrders
    .filter((w) => !PINNED_STATUSES.includes(w.status))
    .sort((a, b) => (SEVERITY[b.severity]?.priority ?? 1) - (SEVERITY[a.severity]?.priority ?? 1));

  for (const wo of sorted) {
    const eligible = technicians.filter((t) => isEligible(wo, t));
    if (eligible.length === 0) continue;
    const best = eligible.reduce((prev, cur) =>
      (techLoad[cur._id.toString()] ?? 0) < (techLoad[prev._id.toString()] ?? 0) ? cur : prev
    );
    chromosome.set(wo._id.toString(), best._id.toString());
    techLoad[best._id.toString()] = (techLoad[best._id.toString()] ?? 0) + (wo.estimatedDurationMin ?? 60);
  }

  return chromosome;
}

/**
 * Tournament selection: pick best of k random individuals.
 */
function tournamentSelect(population, fitnesses, k = 3) {
  let best = null;
  let bestFitness = -Infinity;
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (fitnesses[idx] > bestFitness) {
      bestFitness = fitnesses[idx];
      best = population[idx];
    }
  }
  return best;
}

/**
 * Uniform crossover: each gene (WO) is inherited from either parent with 50% probability.
 * Enforces feasibility by checking eligibility against the receiving parent's allele.
 */
function crossover(parent1, parent2, technicians) {
  const child     = new Map();
  const techMap   = new Map(technicians.map((t) => [t._id.toString(), t]));
  const allKeys   = new Set([...parent1.keys(), ...parent2.keys()]);

  for (const woId of allKeys) {
    const gene1 = parent1.get(woId);
    const gene2 = parent2.get(woId);

    if (gene1 && gene2) {
      child.set(woId, Math.random() < 0.5 ? gene1 : gene2);
    } else if (gene1) {
      child.set(woId, gene1);
    } else if (gene2) {
      child.set(woId, gene2);
    }
  }

  return child;
}

/**
 * Mutation: randomly reassign a gene to a different eligible technician.
 */
function mutate(chromosome, workOrders, technicians, mutationRate = 0.05) {
  const mutant  = new Map(chromosome);
  const woMap   = new Map(workOrders.map((w) => [w._id.toString(), w]));

  for (const [woId, techId] of mutant) {
    if (Math.random() >= mutationRate) continue;
    const wo       = woMap.get(woId);
    if (!wo) continue;
    const eligible = technicians.filter((t) => isEligible(wo, t));
    if (eligible.length === 0) continue;
    mutant.set(woId, eligible[Math.floor(Math.random() * eligible.length)]._id.toString());
  }

  return mutant;
}

/**
 * Run the Genetic Algorithm solver.
 *
 * @param {Object[]} workOrders   - Active (non-pinned) work orders (lean)
 * @param {Object[]} technicians  - Available technicians (lean)
 * @param {Object}   weights      - Cost function weight overrides
 * @param {Object}   options      - GA hyperparameters
 * @param {Function} onProgress   - Callback for streaming progress updates
 * @returns {Object}              - { schedule, assignments, stats }
 */
export function runGeneticAlgorithm(workOrders, technicians, weights = {}, options = {}, onProgress = null) {
  const {
    popSize      = 60,     // Population size
    generations  = 200,    // Number of generations
    mutationRate = 0.05,   // Mutation probability per gene
    eliteCount   = 2,      // Number of elite individuals to carry over unchanged
    tournamentK  = 3,      // Tournament selection size
  } = options;

  const startMs = Date.now();

  // ── 1. Initialize population ───────────────────────────────────────────────
  const population = [];
  // Seed with greedy chromosomes (diversity via 3 greedy + rest random)
  population.push(greedyChromosome(workOrders, technicians));
  population.push(greedyChromosome(workOrders, technicians));
  population.push(greedyChromosome(workOrders, technicians));
  while (population.length < popSize) {
    population.push(randomChromosome(workOrders, technicians));
  }

  let bestChromosome = population[0];
  let bestCost       = computeScheduleCost(population[0], workOrders, technicians, weights);
  let generationBestHistory = [];

  // ── 2. Evolution loop ──────────────────────────────────────────────────────
  let currentPop = population;

  for (let gen = 0; gen < generations; gen++) {
    // Evaluate fitness for all chromosomes (fitness = 1 / (1 + cost) → higher = better)
    const costs     = currentPop.map((c) => computeScheduleCost(c, workOrders, technicians, weights));
    const fitnesses = costs.map((c) => 1 / (1 + c));

    // Track best
    const genBestIdx  = costs.indexOf(Math.min(...costs));
    const genBestCost = costs[genBestIdx];
    generationBestHistory.push(genBestCost);

    if (genBestCost < bestCost) {
      bestCost       = genBestCost;
      bestChromosome = new Map(currentPop[genBestIdx]);
    }

    // Elitism: carry top individuals unchanged
    const indexed  = costs.map((c, i) => ({ c, i })).sort((a, b) => a.c - b.c);
    const nextPop  = indexed.slice(0, eliteCount).map(({ i }) => new Map(currentPop[i]));

    // Fill rest with offspring
    while (nextPop.length < popSize) {
      const parent1  = tournamentSelect(currentPop, fitnesses, tournamentK);
      const parent2  = tournamentSelect(currentPop, fitnesses, tournamentK);
      const child    = crossover(parent1, parent2, technicians);
      const mutant   = mutate(child, workOrders, technicians, mutationRate);
      nextPop.push(mutant);
    }

    currentPop = nextPop;

    // Report progress every 25 generations
    if (onProgress && gen % 25 === 0) {
      onProgress({
        generation: gen,
        generations,
        bestCost,
        genBestCost,
        pctComplete: Math.round(((gen + 1) / generations) * 100),
        populationSize: popSize,
      });
    }
  }

  // ── 3. Build assignments from best chromosome ──────────────────────────────
  const techMap   = new Map(technicians.map((t) => [t._id.toString(), t]));
  const assignments = [];

  for (const wo of workOrders) {
    if (PINNED_STATUSES.includes(wo.status)) continue;
    const woId   = wo._id.toString();
    const techId = bestChromosome.get(woId);
    if (!techId) continue;
    const tech = techMap.get(techId);
    if (!tech) continue;

    assignments.push({
      workOrderId:    wo._id,
      prevTechnician: wo.assignedTechnicianId ?? null,
      newTechnician:  tech._id,
      scheduledStart: new Date(),
      reason:         `GA(pop=${popSize},gen=${generations},μ=${mutationRate}): cost=${bestCost.toFixed(3)}`,
    });
  }

  return {
    schedule:     bestChromosome,
    assignments,
    runtimeMs:    Date.now() - startMs,
    assigned:     assignments.length,
    unassigned:   workOrders.filter((w) => !PINNED_STATUSES.includes(w.status) && !bestChromosome.has(w._id.toString())).length,
    stats: {
      generations,
      populationSize:    popSize,
      finalBestCost:     bestCost,
      candidateSolutions: popSize * generations,
      convergenceHistory: generationBestHistory.filter((_, i) => i % 10 === 0), // every 10th gen
      improvementPct:    generationBestHistory[0] > 0
        ? Math.round(((generationBestHistory[0] - bestCost) / generationBestHistory[0]) * 100)
        : 0,
    },
  };
}
