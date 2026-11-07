import { defineStore } from "pinia";
import { getSupabase } from "@/utils/supabase";
import { useAuthStore } from "@/stores/auth";
import type { Sex } from "@/types";

export interface CoachMentee {
  id: string;
  name: string;
}

export const useProfileStore = defineStore("profile", {
  state: () => ({
    id: "",
    name: "",
    role: "",
    sex: "male" as Sex,
    height: 0,
  }),
  actions: {
    async fetchProfile() {
      const authStore = useAuthStore();
      const supabase = getSupabase();
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, role, sex, height")
          .eq("id", authStore.userId)
          .single();

        if (error) throw error;

        this.id = data.id;
        this.name = data.name;
        this.role = data.role;
        this.sex = data.sex as Sex;
        this.height = data.height;
      } catch (error) {
        console.log("Error fetching profile:", error);
        throw error;
      }
    },

    async fetchMyMentees(): Promise<CoachMentee[]> {
      const supabase = getSupabase(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("role", "mentee")
          .eq("coach_id" as any, this.id);

        if (error) throw error;

        const typedData = (data ?? []) as unknown as Array<{
          id: string;
          name: string;
        }>;

        return typedData.map((m) => ({
          id: m.id,
          name: m.name,
        }));
      } catch (error) {
        console.error("Error fetching mentees:", error);
        throw error;
      }
    },
  },
});
