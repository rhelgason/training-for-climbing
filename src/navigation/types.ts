import type { NavigatorScreenParams } from '@react-navigation/native';

export type AssessStackParamList = {
  AssessHome: undefined;
  Assessment: undefined;
  Results: { assessmentId: string };
  History: undefined;
};

export type ReviewStackParamList = {
  ReviewHome: undefined;
  Glossary: undefined;
};

export type RootTabParamList = {
  Assess: NavigatorScreenParams<AssessStackParamList>;
  Plan: undefined;
  Train: undefined;
  Review: NavigatorScreenParams<ReviewStackParamList>;
};
