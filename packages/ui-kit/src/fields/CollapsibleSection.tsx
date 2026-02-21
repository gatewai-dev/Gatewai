import { ChevronDown } from "lucide-react";
import type React from "react";
import { useState } from "react";

export const CollapsibleSection: React.FC<{
	title: string;
	icon: React.ElementType;
	children: React.ReactNode;
	defaultOpen?: boolean;
}> = ({ title, icon: Icon, children, defaultOpen = true }) => {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	return (
		<div className="border-b border-white/5">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
			>
				<div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300">
					<Icon className="w-3.5 h-3.5" /> {title}
				</div>
				<ChevronDown
					className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`}
				/>
			</button>
			{isOpen && (
				<div className="p-3 pt-2 animate-in slide-in-from-top-1 duration-200">
					{children}
				</div>
			)}
		</div>
	);
};
