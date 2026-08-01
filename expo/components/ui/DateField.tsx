import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { colors, radius, spacing } from "@/constants/theme";
import { formatDMY } from "@/lib/format";
import { Button } from "./Button";
import { Field } from "./Input";
import { PressableScale } from "./motion";
import { AppText } from "./Text";

interface Props {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  placeholder?: string;
}

const fieldRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  backgroundColor: colors.bgElevated,
  borderRadius: radius.md,
  borderWidth: 1.5,
  borderColor: colors.border,
  paddingHorizontal: spacing.md,
  minHeight: 50,
};

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
// Week starts on Monday, French convention.
const WEEKDAYS_FR = ["L", "M", "M", "J", "V", "S", "D"];

/** Date with the time-of-day stripped, for day-level comparisons. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Click-to-pick calendar shown inline under the field on web (where the native
 * date picker is unavailable). Selecting a day fires onChange and collapses it.
 */
function WebCalendar({
  value,
  minimumDate,
  onSelect,
}: {
  value: Date | null;
  minimumDate?: Date;
  onSelect: (date: Date) => void;
}) {
  const base = value ?? new Date();
  const [view, setView] = useState<Date>(new Date(base.getFullYear(), base.getMonth(), 1));
  const today = startOfDay(new Date());
  const min = minimumDate ? startOfDay(minimumDate) : null;

  const year = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // JS getDay(): 0=Sunday..6=Saturday. Shift so Monday is the first column.
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goMonth = (delta: number) => setView(new Date(year, month + delta, 1));

  return (
    <View
      style={{
        marginTop: spacing.sm,
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: colors.border,
        padding: spacing.md,
      }}
    >
      {/* Month navigation */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <PressableScale onPress={() => goMonth(-1)} scaleTo={0.9} style={{ padding: 6 }}>
          <ChevronLeft size={20} color={colors.text} />
        </PressableScale>
        <AppText variant="h3">
          {MONTHS_FR[month]} {year}
        </AppText>
        <PressableScale onPress={() => goMonth(1)} scaleTo={0.9} style={{ padding: 6 }}>
          <ChevronRight size={20} color={colors.text} />
        </PressableScale>
      </View>

      {/* Weekday headings */}
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS_FR.map((w, i) => (
          <View key={i} style={{ flexBasis: "14.285%", alignItems: "center", paddingVertical: 4 }}>
            <AppText variant="bodyMuted" style={{ fontSize: 12, fontWeight: "700" }}>
              {w}
            </AppText>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <View key={`b${i}`} style={{ flexBasis: "14.285%", height: 40 }} />;
          }
          const cellDate = new Date(year, month, day);
          const disabled = min ? startOfDay(cellDate) < min : false;
          const selected = value ? sameDay(cellDate, value) : false;
          const isToday = sameDay(cellDate, today);

          return (
            <View key={`d${day}`} style={{ flexBasis: "14.285%", height: 40, alignItems: "center", justifyContent: "center" }}>
              <PressableScale
                disabled={disabled}
                onPress={() => onSelect(cellDate)}
                scaleTo={0.88}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? colors.primary : "transparent",
                  borderWidth: !selected && isToday ? 1.5 : 0,
                  borderColor: colors.primary,
                  opacity: disabled ? 0.3 : 1,
                }}
              >
                <AppText
                  style={{
                    fontSize: 14.5,
                    fontWeight: selected ? "800" : "500",
                    color: selected ? colors.primaryFg : colors.text,
                  }}
                >
                  {day}
                </AppText>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function DateField({ label, value, onChange, minimumDate, placeholder = "Choisir une date" }: Props) {
  const [show, setShow] = useState<boolean>(false);
  const [temp, setTemp] = useState<Date>(value ?? new Date());

  // Web: tapping the field toggles an inline click-to-pick calendar.
  if (Platform.OS === "web") {
    return (
      <Field label={label}>
        <PressableScale onPress={() => setShow((s) => !s)} scaleTo={0.98} style={fieldRow}>
          <Calendar size={18} color={colors.textFaint} />
          <AppText style={{ flex: 1, color: value ? colors.text : colors.textFaint, fontSize: 15.5, fontWeight: "500", paddingVertical: 14 }}>
            {value ? formatDMY(value) : placeholder}
          </AppText>
        </PressableScale>
        {show ? (
          <WebCalendar
            value={value}
            minimumDate={minimumDate}
            onSelect={(d) => {
              onChange(d);
              setShow(false);
            }}
          />
        ) : null}
      </Field>
    );
  }

  return (
    <Field label={label}>
      <PressableScale
        onPress={() => {
          setTemp(value ?? new Date());
          setShow(true);
        }}
        scaleTo={0.98}
        style={fieldRow}
      >
        <Calendar size={18} color={colors.textFaint} />
        <AppText style={{ flex: 1, color: value ? colors.text : colors.textFaint, fontSize: 15.5, fontWeight: "500" }}>
          {value ? formatDMY(value) : placeholder}
        </AppText>
      </PressableScale>

      {Platform.OS === "android" && show ? (
        <DateTimePicker
          value={temp}
          mode="date"
          minimumDate={minimumDate}
          onChange={(e, d) => {
            setShow(false);
            if (e.type === "set" && d) onChange(d);
          }}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setShow(false)} />
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              padding: spacing.lg,
              paddingBottom: spacing.xxxl,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
              <Button title="Annuler" variant="ghost" size="sm" onPress={() => setShow(false)} />
              <AppText variant="h3">{label ?? "Date"}</AppText>
              <Button
                title="OK"
                variant="ghost"
                size="sm"
                onPress={() => {
                  onChange(temp);
                  setShow(false);
                }}
              />
            </View>
            <DateTimePicker
              value={temp}
              mode="date"
              display="spinner"
              themeVariant="dark"
              textColor={colors.text}
              minimumDate={minimumDate}
              onChange={(_e, d) => {
                if (d) setTemp(d);
              }}
              style={{ alignSelf: "stretch" }}
            />
          </View>
        </Modal>
      ) : null}
    </Field>
  );
}
