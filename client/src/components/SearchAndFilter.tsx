import { Search, Grid3x3, List } from "lucide-react";
import { useState } from "react";

interface SearchAndFilterProps {
  onSearch: (query: string) => void;
  onFilterByType: (type: string) => void;
  onViewChange: (view: "grid" | "list") => void;
  currentView: "grid" | "list";
  fileTypes: string[];
}

export function SearchAndFilter({
  onSearch,
  onFilterByType,
  onViewChange,
  currentView,
  fileTypes,
}: SearchAndFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const handleTypeChange = (type: string) => {
    if (selectedType === type) {
      setSelectedType("");
      onFilterByType("");
    } else {
      setSelectedType(type);
      onFilterByType(type);
    }
  };

  return (
    <div className="space-y-4 animate-slideInDown">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search files by name..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="input-field pl-10"
        />
      </div>

      {/* Filter and View Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {fileTypes.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground self-center">Filter by:</span>
              {fileTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`px-3 py-1 rounded-full text-sm font-medium smooth-transition ${
                    selectedType === type
                      ? "bg-purple-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-accent/20"
                  }`}
                >
                  {type}
                </button>
              ))}
            </>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 bg-muted p-1 rounded-lg">
          <button
            onClick={() => onViewChange("grid")}
            className={`p-2 rounded smooth-transition ${
              currentView === "grid"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Grid view"
          >
            <Grid3x3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => onViewChange("list")}
            className={`p-2 rounded smooth-transition ${
              currentView === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="List view"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
