import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class COPILMasterAPITester:
    def __init__(self, base_url="https://smart-agenda-timer.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            if expected_status and actual_status:
                print(f"   Expected: {expected_status}, Got: {actual_status}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "expected_status": expected_status,
            "actual_status": actual_status
        })

    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = requests.get(f"{self.api_url}/")
            success = response.status_code == 200
            self.log_test("Root API endpoint", success, 
                         response.json() if success else f"Status: {response.status_code}",
                         200, response.status_code)
            return success
        except Exception as e:
            self.log_test("Root API endpoint", False, str(e))
            return False

    def create_test_user_session(self):
        """Create test user and session in MongoDB"""
        try:
            import pymongo
            client = pymongo.MongoClient("mongodb://localhost:27017")
            db = client["test_database"]
            
            # Create test user
            self.user_id = f"test-user-{int(datetime.now().timestamp())}"
            test_email = f"test.user.{int(datetime.now().timestamp())}@example.com"
            
            user_doc = {
                "user_id": self.user_id,
                "email": test_email,
                "name": "Test User",
                "picture": "https://via.placeholder.com/150",
                "created_at": datetime.utcnow().isoformat()
            }
            db.users.insert_one(user_doc)
            
            # Create session
            self.session_token = f"test_session_{int(datetime.now().timestamp())}"
            session_doc = {
                "user_id": self.user_id,
                "session_token": self.session_token,
                "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
            db.user_sessions.insert_one(session_doc)
            
            self.log_test("Create test user and session", True, f"User: {self.user_id}, Token: {self.session_token[:20]}...")
            return True
            
        except Exception as e:
            self.log_test("Create test user and session", False, str(e))
            return False

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{self.api_url}/auth/me", headers=headers)
            success = response.status_code == 200
            self.log_test("Auth /me endpoint", success,
                         response.json() if success else f"Status: {response.status_code}",
                         200, response.status_code)
            return success
        except Exception as e:
            self.log_test("Auth /me endpoint", False, str(e))
            return False

    def test_stats_endpoint(self):
        """Test /stats endpoint"""
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{self.api_url}/stats", headers=headers)
            success = response.status_code == 200
            if success:
                data = response.json()
                required_fields = ["total_meetings", "upcoming_meetings", "pending_tasks", "completed_tasks"]
                has_all_fields = all(field in data for field in required_fields)
                success = has_all_fields
                details = f"Stats: {data}" if has_all_fields else f"Missing fields in: {data}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Stats endpoint", success, details, 200, response.status_code)
            return success
        except Exception as e:
            self.log_test("Stats endpoint", False, str(e))
            return False

    def test_meetings_crud(self):
        """Test meetings CRUD operations"""
        headers = {"Authorization": f"Bearer {self.session_token}"}
        meeting_id = None
        
        # Test GET meetings (empty list)
        try:
            response = requests.get(f"{self.api_url}/meetings", headers=headers)
            success = response.status_code == 200
            self.log_test("GET meetings", success, 
                         f"Count: {len(response.json()) if success else 'Error'}",
                         200, response.status_code)
        except Exception as e:
            self.log_test("GET meetings", False, str(e))
            return False

        # Test CREATE meeting
        try:
            meeting_data = {
                "title": "Test COPIL Meeting",
                "description": "Test meeting for API validation",
                "scheduled_date": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                "participants": ["participant1@example.com", "participant2@example.com"],
                "agenda": [
                    {
                        "title": "Opening",
                        "duration_minutes": 5,
                        "speaker": "Test Speaker",
                        "description": "Meeting opening"
                    },
                    {
                        "title": "Main Discussion",
                        "duration_minutes": 30,
                        "speaker": "Test Speaker 2",
                        "description": "Main agenda item"
                    }
                ]
            }
            
            response = requests.post(f"{self.api_url}/meetings", headers=headers, json=meeting_data)
            success = response.status_code == 200
            if success:
                result = response.json()
                meeting_id = result.get("meeting_id")
                details = f"Created meeting: {meeting_id}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("CREATE meeting", success, details, 200, response.status_code)
            
            if not success:
                return False
                
        except Exception as e:
            self.log_test("CREATE meeting", False, str(e))
            return False

        # Test GET specific meeting
        if meeting_id:
            try:
                response = requests.get(f"{self.api_url}/meetings/{meeting_id}", headers=headers)
                success = response.status_code == 200
                if success:
                    meeting = response.json()
                    details = f"Title: {meeting.get('title')}, Agenda items: {len(meeting.get('agenda', []))}"
                else:
                    details = f"Status: {response.status_code}"
                
                self.log_test("GET specific meeting", success, details, 200, response.status_code)
            except Exception as e:
                self.log_test("GET specific meeting", False, str(e))

        # Test meeting timer operations
        if meeting_id:
            try:
                # Start meeting
                response = requests.post(f"{self.api_url}/meetings/{meeting_id}/start", headers=headers)
                success = response.status_code == 200
                self.log_test("START meeting", success, 
                             response.json() if success else f"Status: {response.status_code}",
                             200, response.status_code)
                
                # Next item
                response = requests.post(f"{self.api_url}/meetings/{meeting_id}/next-item", headers=headers)
                success = response.status_code == 200
                self.log_test("NEXT agenda item", success,
                             response.json() if success else f"Status: {response.status_code}",
                             200, response.status_code)
                
                # Complete meeting
                response = requests.post(f"{self.api_url}/meetings/{meeting_id}/complete", headers=headers)
                success = response.status_code == 200
                self.log_test("COMPLETE meeting", success,
                             response.json() if success else f"Status: {response.status_code}",
                             200, response.status_code)
                
            except Exception as e:
                self.log_test("Meeting timer operations", False, str(e))

        return True

    def test_tasks_crud(self):
        """Test tasks CRUD operations"""
        headers = {"Authorization": f"Bearer {self.session_token}"}
        task_id = None
        
        # Test GET tasks (empty list)
        try:
            response = requests.get(f"{self.api_url}/tasks", headers=headers)
            success = response.status_code == 200
            self.log_test("GET tasks", success,
                         f"Count: {len(response.json()) if success else 'Error'}",
                         200, response.status_code)
        except Exception as e:
            self.log_test("GET tasks", False, str(e))
            return False

        # Test CREATE task
        try:
            task_data = {
                "title": "Test Task",
                "description": "Test task for API validation",
                "assignee_email": "test@example.com",
                "assignee_name": "Test User",
                "due_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "priority": "high"
            }
            
            response = requests.post(f"{self.api_url}/tasks", headers=headers, json=task_data)
            success = response.status_code == 200
            if success:
                result = response.json()
                task_id = result.get("task_id")
                details = f"Created task: {task_id}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("CREATE task", success, details, 200, response.status_code)
            
        except Exception as e:
            self.log_test("CREATE task", False, str(e))
            return False

        # Test UPDATE task
        if task_id:
            try:
                update_data = {"status": "completed"}
                response = requests.put(f"{self.api_url}/tasks/{task_id}", headers=headers, json=update_data)
                success = response.status_code == 200
                self.log_test("UPDATE task", success,
                             response.json() if success else f"Status: {response.status_code}",
                             200, response.status_code)
            except Exception as e:
                self.log_test("UPDATE task", False, str(e))

        return True

    def test_reports_endpoint(self):
        """Test reports endpoints"""
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test GET reports
        try:
            response = requests.get(f"{self.api_url}/reports", headers=headers)
            success = response.status_code == 200
            self.log_test("GET reports", success,
                         f"Count: {len(response.json()) if success else 'Error'}",
                         200, response.status_code)
        except Exception as e:
            self.log_test("GET reports", False, str(e))
            return False

        # Note: We won't test report generation as it requires a completed meeting and AI integration
        # which might be slow and require valid API keys
        
        return True

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting COPIL Master Backend API Tests")
        print("=" * 50)
        
        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Root endpoint failed - stopping tests")
            return False
        
        # Create test user and session
        if not self.create_test_user_session():
            print("❌ Failed to create test user - stopping tests")
            return False
        
        # Test authentication
        if not self.test_auth_me():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Test all endpoints
        self.test_stats_endpoint()
        self.test_meetings_crud()
        self.test_tasks_crud()
        self.test_reports_endpoint()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed")
            return False

def main():
    tester = COPILMasterAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())