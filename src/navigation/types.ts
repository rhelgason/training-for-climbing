import type { NavigatorScreenParams } from '@react-navigation/native';

export type AssessStackParamList = {
  AssessHome: undefined;
  Assessment: undefined;
  Results: { assessmentId: string };
  History: undefined;
  Fitness: undefined;
  FitnessForm: undefined;
};

export type PlanStackParamList = {
  PlanHome: undefined;
  Goals: undefined;
  GoalForm: { goalId?: string } | undefined;
  ProgramBuilder: undefined;
  Macrocycle: undefined;
  MacrocycleForm: { periodId?: string } | undefined;
};

export type TrainStackParamList = {
  TrainHome: undefined;
  SessionForm: undefined;
  EnergyEmotion: undefined;
  CheckinForm: undefined;
  Exercises: undefined;
};

export type ProgressStackParamList = {
  Dashboard: undefined;
  Climbs: undefined;
  ClimbForm: undefined;
};

export type ReviewStackParamList = {
  ReviewHome: undefined;
  Glossary: undefined;
};

export type RootTabParamList = {
  Assess: NavigatorScreenParams<AssessStackParamList>;
  Plan: NavigatorScreenParams<PlanStackParamList>;
  Train: NavigatorScreenParams<TrainStackParamList>;
  Progress: NavigatorScreenParams<ProgressStackParamList>;
  Review: NavigatorScreenParams<ReviewStackParamList>;
};
