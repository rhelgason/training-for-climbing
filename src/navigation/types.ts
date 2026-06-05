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

export type ReviewStackParamList = {
  ReviewHome: undefined;
  Glossary: undefined;
};

export type RootTabParamList = {
  Assess: NavigatorScreenParams<AssessStackParamList>;
  Plan: NavigatorScreenParams<PlanStackParamList>;
  Train: undefined;
  Review: NavigatorScreenParams<ReviewStackParamList>;
};
