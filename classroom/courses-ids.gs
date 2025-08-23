// To use the script, add Google Classroom Api in the services tab
function listClassroomCourseIds() {
  const optionalArgs = {
    pageSize: 50,
    courseStates: ['ACTIVE']
  };

  const response = Classroom.Courses.list(optionalArgs);
  const courses = response.courses;

  if (!courses || courses.length === 0) {
    Logger.log('No courses found.');
  } else {
    Logger.log('Courses found:');
    courses.forEach(course => {
      Logger.log(`📘 ${course.name} → ID: ${course.id}`);
    });
  }
}
