interface DashboardCardProps {
    title: string;
    value: string;
    index?: number;
}

const DashboardCard = ({ title, value, index = 0 }: DashboardCardProps) => {
    // Alternate styles or choose custom styling based on index
    const isEven = index % 2 === 0;
    const valueColor = isEven 
        ? "text-brand-blue" 
        : "text-brand-peacock";
    const bgAccent = isEven
        ? "group-hover:bg-brand-blue/5"
        : "group-hover:bg-brand-peacock/5";

    return (
        <div className="group bg-white rounded-2xl border border-gray-100 p-6 hover:border-transparent hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
            <h3 className="text-slate-500 font-medium text-sm tracking-wide uppercase">{title}</h3>
            <div className="flex items-baseline justify-between mt-4">
                <p className={`text-4xl font-extrabold tracking-tight ${valueColor}`}>
                    {value}
                </p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300 ${bgAccent}`}>
                    <span className={`text-lg font-bold ${valueColor}`}>→</span>
                </div>
            </div>
        </div>
    );
};

export default DashboardCard;