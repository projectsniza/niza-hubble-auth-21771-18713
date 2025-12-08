import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, GraduationCap } from "lucide-react";

export default function ELearning() {
  const courses = [
    {
      title: "Health and safety awareness",
      description: "This course is to help you continue learning and reinforce key messages about awareness. Additionally, it will provide you with tips and strategies for reducing risk and avoiding these on-the-job injuries.",
      image: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop"
    },
    {
      title: "Display screen equipment",
      description: "The aim of this course is to enable personnel to be both competent and confident to carry out suitable assessments in relation to Display Screen Equipment and workstations to ensure they comply with the relevant regulations.",
      image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop"
    },
    {
      title: "Risk assessments",
      description: "This course gives those with a duty of care, the skills to identify the hazards and risks associated with their workplace, and the knowledge required to implement control measures whilst supporting statutory compliance.",
      image: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=300&fit=crop"
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">E-Learning</h1>
          <p className="text-muted-foreground">Professional safety training and development courses</p>
        </div>
        <Card className="bg-gradient-to-r from-primary to-accent text-white px-6 py-3 shadow-lg border-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            <div>
              <span className="font-bold block">PREMIUM ACCESS</span>
              <span className="text-xs opacity-90">e-learning excellence</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-4 mb-6 border-b border-border">
        <button className="pb-3 text-muted-foreground hover:text-foreground px-4 transition-colors">
          Assigned to me
        </button>
        <button className="pb-3 border-b-2 border-primary text-primary font-medium px-4 transition-colors">
          All courses
        </button>
        <button className="pb-3 text-muted-foreground hover:text-foreground px-4 transition-colors">
          Permissions
        </button>
      </div>

      <h2 className="text-2xl font-semibold mb-6 text-foreground">All courses</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">Search</h3>
          <div className="relative">
            <Input
              placeholder="Title, description"
              className="pr-10"
            />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Industries</h3>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search or select"
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses.map((course, index) => (
          <Card 
            key={index} 
            className="overflow-hidden hover:shadow-lg transition-all group border-border cursor-pointer"
          >
            <div className="relative overflow-hidden">
              <img 
                src={course.image} 
                alt={course.title}
                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0 shadow-lg">
                  Accredited
                </Badge>
                <Badge className="bg-gradient-to-r from-accent to-primary text-white border-0 shadow-lg">
                  CPD Certified
                </Badge>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-lg mb-2 text-foreground group-hover:text-primary transition-colors">
                {course.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                {course.description}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
