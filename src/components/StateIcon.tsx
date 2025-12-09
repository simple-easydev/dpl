import {
  MapPin,
  Mountain,
  Palmtree,
  Sun,
  Waves,
  Snowflake,
  TreePine,
  Wheat,
  Building2,
  Factory,
  Landmark,
  Ship,
  Plane,
  Wind,
  Cloud,
  Zap,
  Leaf
} from 'lucide-react';

const stateIconMap: { [key: string]: any } = {
  'Alabama': Factory,
  'Alaska': Snowflake,
  'Arizona': Sun,
  'Arkansas': TreePine,
  'California': Palmtree,
  'Colorado': Mountain,
  'Connecticut': Ship,
  'Delaware': Ship,
  'Florida': Palmtree,
  'Georgia': TreePine,
  'Hawaii': Waves,
  'Idaho': Mountain,
  'Illinois': Wheat,
  'Indiana': Factory,
  'Iowa': Wheat,
  'Kansas': Wheat,
  'Kentucky': TreePine,
  'Louisiana': Ship,
  'Maine': Lighthouse,
  'Maryland': Ship,
  'Massachusetts': Ship,
  'Michigan': Waves,
  'Minnesota': Snowflake,
  'Mississippi': Ship,
  'Missouri': Landmark,
  'Montana': Mountain,
  'Nebraska': Wheat,
  'Nevada': Sun,
  'New Hampshire': Mountain,
  'New Jersey': Factory,
  'New Mexico': Sun,
  'New York': Building2,
  'North Carolina': TreePine,
  'North Dakota': Wheat,
  'Ohio': Factory,
  'Oklahoma': Wind,
  'Oregon': TreePine,
  'Pennsylvania': Factory,
  'Rhode Island': Ship,
  'South Carolina': Palmtree,
  'South Dakota': Mountain,
  'Tennessee': TreePine,
  'Texas': Sun,
  'Utah': Mountain,
  'Vermont': Mountain,
  'Virginia': Landmark,
  'Washington': TreePine,
  'West Virginia': Mountain,
  'Wisconsin': Leaf,
  'Wyoming': Mountain,
};

function Lighthouse(props: any) {
  return <Landmark {...props} />;
}

interface StateIconProps {
  stateName: string | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export default function StateIcon({ stateName, className = 'w-4 h-4', showLabel = false }: StateIconProps) {
  if (!stateName) {
    return showLabel ? (
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-zinc-500">
        <MapPin className={className} />
        <span className="text-sm">No State</span>
      </div>
    ) : (
      <MapPin className={`${className} text-gray-400 dark:text-zinc-500`} />
    );
  }

  const normalizedState = stateName.trim();
  const IconComponent = stateIconMap[normalizedState] || MapPin;

  if (showLabel) {
    return (
      <div className="flex items-center gap-1.5 text-gray-700 dark:text-zinc-300" title={normalizedState}>
        <IconComponent className={className} />
        <span className="text-sm font-medium">{normalizedState}</span>
      </div>
    );
  }

  return (
    <div className="relative group">
      <IconComponent className={className} />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-900 dark:bg-zinc-100 text-white dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {normalizedState}
      </div>
    </div>
  );
}
