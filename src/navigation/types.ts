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
  JournalForm: { journalId?: string } | undefined;
  EnergyEmotion: undefined;
  CheckinForm: undefined;
  Exercises: undefined;
};

export type ProgressStackParamList = {
  Dashboard: undefined;
  Climbs: undefined;
  ClimbForm: { climbId?: string } | undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Profile: undefined;
  Glossary: undefined;
  Account: undefined;
};

export type RootTabParamList = {
  Assess: NavigatorScreenParams<AssessStackParamList>;
  Plan: NavigatorScreenParams<PlanStackParamList>;
  Train: NavigatorScreenParams<TrainStackParamList>;
  Progress: NavigatorScreenParams<ProgressStackParamList>;
  More: NavigatorScreenParams<MoreStackParamList>;
};
