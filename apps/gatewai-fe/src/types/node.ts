import type { Node as DBNode } from '@gatewai/types';
import type { Node } from '@xyflow/react';
import type { NodeTemplateWithIO } from './node-template';

export type DbNodeWithTemplate = DBNode & {
  template: NodeTemplateWithIO
};

export type ClientNode = Node<DbNodeWithTemplate>;
