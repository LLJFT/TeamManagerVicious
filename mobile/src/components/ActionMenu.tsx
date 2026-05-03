import React from 'react';
import { View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { ListItem } from './ListItem';

export type ActionMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function ActionMenu({
  visible,
  onClose,
  title,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: ActionMenuItem[];
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View>
        {items.map((it) => (
          <ListItem
            key={it.key}
            title={it.label}
            onPress={() => {
              onClose();
              it.onPress();
            }}
            testID={`action-${it.key}`}
          />
        ))}
      </View>
    </BottomSheet>
  );
}
