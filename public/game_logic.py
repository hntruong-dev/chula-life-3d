"""
A Day at Chula — Python game logic.
This file runs in the browser through Pyodide. Three.js handles rendering only.
"""
import json

FLOOR_NAMES = {
    1: "LEARNING COMMONS",
    2: "GROUP STUDY",
    3: "MULTIMEDIA & MEETING",
    4: "HUMANITIES & SCIENCE",
    5: "SOCIAL SCIENCES",
    6: "ASEAN & RARE COLLECTIONS",
    7: "MEETING & EXHIBITION",
}

TASKS = [
    ("checkin", "Check in at the library"),
    ("coffee", "Get a coffee before research"),
    ("book", "Find a PM₂.₅ / atmospheric science book"),
    ("study", "Work on the research manuscript"),
    ("friend", "Meet a Vietnamese friend"),
    ("print", "Print your updated research notes"),
]

class StudentLife:
    def __init__(self):
        self.minutes = 8 * 60
        self.floor = 1
        self.money = 500
        self.energy = 92
        self.hunger = 35
        self.stress = 18
        self.research = 0
        self.social = 0
        self.done = set()
        self.elapsed = 0.0
        self.ended = False
        self.last_message = "A new day in Bangkok. Let's make it count."
        self.day_score = 0

    def _clamp(self, value):
        return max(0, min(100, int(round(value))))

    def _time(self):
        h, m = divmod(self.minutes, 60)
        return f"{h:02d}:{m:02d}"

    def _objective(self):
        for key, label in TASKS:
            if key not in self.done:
                return label
        return "Day complete — take a breath and enjoy Bangkok."

    def _task_list(self):
        return [
            {"key": key, "label": label, "done": key in self.done}
            for key, label in TASKS
        ]

    def state(self):
        return {
            "time": self._time(),
            "floor": self.floor,
            "floor_name": FLOOR_NAMES.get(self.floor, "CENTRAL LIBRARY"),
            "money": self.money,
            "energy": self._clamp(self.energy),
            "hunger": self._clamp(self.hunger),
            "stress": self._clamp(self.stress),
            "research": self._clamp(self.research),
            "social": self._clamp(self.social),
            "objective": self._objective(),
            "tasks": self._task_list(),
            "done_count": len(self.done),
            "task_count": len(TASKS),
            "ended": self.ended,
            "last_message": self.last_message,
        }

    def state_json(self):
        return json.dumps(self.state(), ensure_ascii=False)

    def _spend(self, amount):
        if self.money < amount:
            return False
        self.money -= amount
        return True

    def _message(self, text):
        self.last_message = text
        return json.dumps({"message": text, "state": self.state()}, ensure_ascii=False)

    def tick(self, dt):
        if self.ended:
            return
        self.elapsed += max(0.0, min(float(dt), 0.25))
        # One in-game five-minute block passes every 12 real seconds.
        while self.elapsed >= 12.0:
            self.elapsed -= 12.0
            self.minutes += 5
            self.hunger = min(100, self.hunger + 0.45)
            self.energy = max(0, self.energy - 0.22)
            self.stress = min(100, self.stress + 0.12)
            if self.minutes >= 21 * 60:
                self.ended = True
                self.last_message = "The library day is over. You made it through Bangkok."
        if self.energy <= 8:
            self.stress = min(100, self.stress + 0.08)

    def go_to_floor(self, floor):
        floor = int(floor)
        if floor < 1 or floor > 7:
            return self._message("That floor is not available.")
        self.floor = floor
        return self._message(f"You arrive at Floor {floor}: {FLOOR_NAMES[floor]}.")

    def interact(self, action):
        action = str(action)

        if action == "checkin":
            if "checkin" in self.done:
                return self._message("You're already checked in. Welcome back.")
            self.done.add("checkin")
            return self._message("Library check-in complete. The day officially begins.")

        if action == "coffee":
            if not self._spend(85):
                return self._message("Not enough baht for coffee. Maybe take a water break instead.")
            self.done.add("coffee")
            self.hunger = max(0, self.hunger - 12)
            self.energy = min(100, self.energy + 17)
            return self._message("Iced Thai coffee acquired. Energy +17, ฿85 spent. Back to research.")

        if action == "book":
            if "book" in self.done:
                return self._message("You already found the atmospheric science reference.")
            self.done.add("book")
            self.research = min(100, self.research + 12)
            self.stress = max(0, self.stress - 3)
            return self._message("Found a useful atmospheric science reference. One more piece for the literature review.")

        if action == "study":
            if "study" in self.done:
                self.research = min(100, self.research + 4)
                self.energy = max(0, self.energy - 5)
                return self._message("Another focused work session. Small progress still counts.")
            self.done.add("study")
            self.research = min(100, self.research + 32)
            self.energy = max(0, self.energy - 18)
            self.stress = min(100, self.stress + 9)
            return self._message("A solid research session. You cleaned the PM₂.₅ dataset and revised part of the manuscript. Research +32.")

        if action == "friend":
            if "friend" in self.done:
                self.social = min(100, self.social + 5)
                return self._message("You catch up for a moment. It helps to speak Vietnamese after a long day.")
            self.done.add("friend")
            self.social = min(100, self.social + 28)
            self.stress = max(0, self.stress - 13)
            return self._message("A familiar Vietnamese voice in Bangkok. You exchange research stories, homesickness and plans for dinner.")

        if action == "print":
            if not self._spend(10):
                return self._message("You need ฿10 to print. Check your wallet.")
            self.done.add("print")
            self.research = min(100, self.research + 8)
            return self._message("Your research notes are printed. The final task is complete — you earned today's progress.")

        if action == "lunch":
            if not self._spend(120):
                return self._message("You don't have enough baht for this meal.")
            self.hunger = max(0, self.hunger - 38)
            self.energy = min(100, self.energy + 9)
            self.stress = max(0, self.stress - 4)
            return self._message("A simple lunch break. Hunger -38, Energy +9. Remember to hydrate.")

        if action == "relax":
            self.stress = max(0, self.stress - 18)
            self.energy = min(100, self.energy + 8)
            self.minutes += 10
            return self._message("Ten minutes away from the screen. Your mind feels a little clearer.")

        if action == "groupstudy":
            self.research = min(100, self.research + 15)
            self.social = min(100, self.social + 8)
            self.stress = max(0, self.stress - 4)
            return self._message("A useful group discussion. You see the research question from another angle.")

        if action == "browse":
            return self._message("A quiet moment among the shelves. Sometimes the best idea arrives when you stop searching.")

        if action == "water":
            self.hunger = max(0, self.hunger - 3)
            self.stress = max(0, self.stress - 2)
            return self._message("A glass of water. A small reset.")

        return self._message("Nothing to do here right now.")

    def finish_day(self):
        self.ended = True
        self.day_score = int(self.research * 0.65 + self.social * 0.15 + self.energy * 0.20)
        return json.dumps({
            "message": "Day complete",
            "score": self.day_score,
            "tasks_done": len(self.done),
            "state": self.state()
        }, ensure_ascii=False)

game = StudentLife()
