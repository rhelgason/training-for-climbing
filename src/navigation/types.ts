import type { NavigatorScreenParams } from '@react-navigation/native';

export type AssessStackParamList = {
  AssessHome: undefined;
  Assessment: undefined;
  Results: { assessmentId: string };
  History: undefined;
};

export type PlanStackParamList = {
  PlanHome: undefined;
  Goals: undefined;
  GoalForm: { goalId?: string } | undefined;
  ProgramBuilder: undefined;
};

export type TrainStackParamList = {
  TrainHome: undefined;
  SessionForm: undefined;
  EnergyEmotion: undefined;
  CheckinForm: undefined;
};

export type ReviewStackParamList = {
  ReviewHome: undefined;
  Glossary: undefined;
};

export type RootTabParamList = {
  Assess: NavigatorScreenParams<AssessStackParamList>;
  Plan: NavigatorScreenParams<PlanStackParamList>;
  Train: NavigatorScreenParams<TrainStackParamList>;
  Review: NavigatorScreenParams<ReviewStackParamList>;
};
